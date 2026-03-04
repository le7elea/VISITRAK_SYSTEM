import { randomBytes } from "crypto";
import sgMail from "@sendgrid/mail";
import { getAdmin } from "../server/firebaseAdmin.js";

const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

const getBearerToken = (req) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
};

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const normalizeUsername = (username = "") => username.trim().toLowerCase();
const normalizeIdentifier = (value = "") => value.trim().toLowerCase();
const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{2,30}[a-z0-9]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_DEDUPE_MS = 5 * 60 * 1000;
const PUBLIC_COOLDOWN_MS = 10 * 1000;
const REQUEST_EXPIRATION_MS = 15 * 60 * 1000;
const SUPER_EMAIL_RESET_EXPIRATION_MS = 15 * 60 * 1000;
const REQUEST_EXPIRY_REASON =
  "Request expired after 15 minutes without super admin action.";
const REQUEST_CANCEL_REASON = "Request cancelled by office admin before approval.";
const ALLOWED_STATUS_FILTERS = new Set([
  "all",
  "pending",
  "approved",
  "rejected",
  "expired",
  "cancelled",
]);

const requesterLastSeen = new Map();

const isQuotaExceededError = (error) => {
  const code = String(error?.code || "").trim().toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "resource-exhausted" ||
    code === "8" ||
    message.includes("resource_exhausted") ||
    message.includes("quota exceeded")
  );
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

const isPendingRequestExpired = (requestData, nowMs = Date.now()) => {
  const status = requestData?.status || "pending";
  if (status !== "pending") return false;

  const requestedAt = toDate(requestData?.requestedAt);
  if (!requestedAt) return false;

  return nowMs - requestedAt.getTime() >= REQUEST_EXPIRATION_MS;
};

const archivePendingResetNotifications = async (
  db,
  admin,
  requestId,
  status = "expired"
) => {
  if (!requestId) return;

  const notificationsSnapshot = await db
    .collection("adminNotifications")
    .where("requestId", "==", requestId)
    .limit(30)
    .get();

  if (notificationsSnapshot.empty) return;

  const batch = db.batch();
  notificationsSnapshot.docs
    .filter((doc) => (doc.data()?.type || "") === "password_reset_request")
    .forEach((doc) => {
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

const markResetRequestExpired = async (db, admin, requestId, existingData = {}) => {
  if (!requestId) {
    return {
      ...(existingData || {}),
      status: "expired",
      reason: existingData?.reason || REQUEST_EXPIRY_REASON,
    };
  }

  const reason = existingData?.reason || REQUEST_EXPIRY_REASON;
  const requestRef = db.collection("passwordResetRequests").doc(requestId);
  await requestRef.set(
    {
      status: "expired",
      reason,
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedByUid: null,
      resolvedByEmail: "",
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await archivePendingResetNotifications(db, admin, requestId);

  const now = new Date();
  return {
    ...(existingData || {}),
    status: "expired",
    reason,
    resolvedAt: now,
    resolvedByUid: null,
    resolvedByEmail: "",
    lastUpdatedAt: now,
  };
};

const markResetRequestCancelled = async (
  db,
  admin,
  requestId,
  existingData = {}
) => {
  if (!requestId) {
    return {
      ...(existingData || {}),
      status: "cancelled",
      reason: existingData?.reason || REQUEST_CANCEL_REASON,
    };
  }

  const reason = existingData?.reason || REQUEST_CANCEL_REASON;
  const requestRef = db.collection("passwordResetRequests").doc(requestId);
  await requestRef.set(
    {
      status: "cancelled",
      reason,
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedByUid: null,
      resolvedByEmail: "",
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await archivePendingResetNotifications(db, admin, requestId, "cancelled");

  const now = new Date();
  return {
    ...(existingData || {}),
    status: "cancelled",
    reason,
    resolvedAt: now,
    resolvedByUid: null,
    resolvedByEmail: "",
    lastUpdatedAt: now,
  };
};

const findOfficeByIdentifier = async (db, identifier, admin = null) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier) {
    return {
      officeDoc: null,
      usernameNormalized: "",
    };
  }

  let officeDoc = null;

  if (EMAIL_REGEX.test(normalizedIdentifier)) {
    const byEmail = await db
      .collection("offices")
      .where("email", "==", normalizedIdentifier)
      .limit(5)
      .get();

    const matched = byEmail.docs.find(
      (doc) => (doc.data()?.role || "office") === "office"
    );
    if (matched) {
      officeDoc = matched;
    }

    // Fallback: resolve office doc through Firebase Auth email -> UID.
    // This supports office records where email is not mirrored in offices.email.
    if (!officeDoc && admin) {
      try {
        const authUser = await admin.auth().getUserByEmail(normalizedIdentifier);
        if (authUser?.uid) {
          const byUid = await db.collection("offices").doc(authUser.uid).get();
          if (byUid.exists && (byUid.data()?.role || "office") === "office") {
            officeDoc = byUid;
          }
        }
      } catch (error) {
        const code = String(error?.code || "");
        const isNotFound = code === "auth/user-not-found";
        if (!isNotFound) {
          console.error("findOfficeByIdentifier auth email lookup error:", error);
        }
      }
    }
  }

  if (!officeDoc) {
    const usernameCandidate = normalizeUsername(normalizedIdentifier);
    if (!USERNAME_REGEX.test(usernameCandidate)) {
      return {
        officeDoc: null,
        usernameNormalized: "",
      };
    }

    const byUsername = await db
      .collection("offices")
      .where("usernameNormalized", "==", usernameCandidate)
      .limit(5)
      .get();

    const matched = byUsername.docs.find(
      (doc) => (doc.data()?.role || "office") === "office"
    );
    if (matched) {
      officeDoc = matched;
    }
  }

  if (!officeDoc) {
    return {
      officeDoc: null,
      usernameNormalized: "",
    };
  }

  const officeData = officeDoc.data() || {};
  const resolvedUsername = normalizeUsername(
    officeData.usernameNormalized || officeData.username || ""
  );

  if (!USERNAME_REGEX.test(resolvedUsername)) {
    return {
      officeDoc: null,
      usernameNormalized: "",
    };
  }

  return {
    officeDoc,
    usernameNormalized: resolvedUsername,
  };
};

const getRequesterAddress = (req) => {
  const ip =
    req.headers["x-forwarded-for"] ||
    req.connection?.remoteAddress ||
    "unknown";
  return String(ip).split(",")[0].trim();
};

const canCreatePublicRequest = (key) => {
  const now = Date.now();
  const previous = requesterLastSeen.get(key) || 0;
  if (now - previous < PUBLIC_COOLDOWN_MS) return false;
  requesterLastSeen.set(key, now);
  return true;
};

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

const getSuperAdminEmails = async (db) => {
  const emails = new Set();

  const envEmails = String(process.env.SUPER_ADMIN_EMAIL || "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter((email) => EMAIL_REGEX.test(email));
  envEmails.forEach((email) => emails.add(email));

  const superDocs = await db
    .collection("offices")
    .where("role", "==", "super")
    .limit(20)
    .get();

  superDocs.forEach((doc) => {
    const data = doc.data() || {};
    const email = normalizeEmail(data.email || "");
    if (EMAIL_REGEX.test(email)) emails.add(email);
  });

  return Array.from(emails);
};

const sendSuperAdminAlert = async ({ superAdminEmails, officeName, username }) => {
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) return;
  if (!Array.isArray(superAdminEmails) || superAdminEmails.length === 0) return;

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    "https://visitrak-system.vercel.app";
  const dashboardLink = appUrl.startsWith("http")
    ? `${appUrl}/dashboard`
    : `https://${appUrl}/dashboard`;

  const message = {
    to: superAdminEmails,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: "VisiTrak System",
    },
    subject: "Office Password Reset Approval Required",
    text: `A password reset request was submitted for office "${officeName}" (username: ${username}). Review it in your dashboard: ${dashboardLink}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#222">
        <h2 style="margin:0 0 12px;">Password Reset Approval Required</h2>
        <p style="margin:0 0 10px;">
          An office admin requested a password reset.
        </p>
        <p style="margin:0 0 10px;">
          <strong>Office:</strong> ${officeName}<br />
          <strong>Username:</strong> ${username}
        </p>
        <p style="margin:0;">
          Review this request in your VisiTrak dashboard:
          <a href="${dashboardLink}">${dashboardLink}</a>
        </p>
      </div>
    `,
  };

  try {
    await sgMail.sendMultiple(message);
  } catch (error) {
    console.error("sendSuperAdminAlert error:", error?.message || error);
  }
};

const resolveAppUrl = (req) => {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) {
    return process.env.VERCEL_URL.startsWith("http")
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`;
  }
  const host = req.headers["x-forwarded-host"];
  if (host) return `https://${host}`;
  return "https://visitrak-system.vercel.app";
};

const getSuperAdminDisplayName = (officeData = {}) => {
  const value = String(
    officeData.officialName || officeData.name || "SCHOOL ADMIN"
  ).trim();
  return value || "SCHOOL ADMIN";
};

const createSuperEmailResetRequest = async (req, res, admin, db) => {
  const email = normalizeEmail(req.body?.email || req.body?.identifier || "");
  const genericResponse = () =>
    res.status(200).json({
      success: true,
      message:
        "If this email is registered, a password reset link has been sent. Please check your inbox.",
    });

  if (!EMAIL_REGEX.test(email)) {
    return genericResponse();
  }

  let authUser = null;
  try {
    authUser = await admin.auth().getUserByEmail(email);
  } catch (error) {
    if (String(error?.code || "") === "auth/user-not-found") {
      return genericResponse();
    }
    throw error;
  }

  if (!authUser?.uid) return genericResponse();

  const officeDocByUid = await db.collection("offices").doc(authUser.uid).get();
  let officeData = officeDocByUid.exists ? officeDocByUid.data() || {} : {};
  let isSuper = (officeData.role || "").toLowerCase() === "super";

  if (!isSuper) {
    const byEmail = await db
      .collection("offices")
      .where("email", "==", email)
      .limit(5)
      .get();

    const superDoc = byEmail.docs.find(
      (doc) => (doc.data()?.role || "").toLowerCase() === "super"
    );

    if (!superDoc) {
      return genericResponse();
    }

    officeData = superDoc.data() || {};
    isSuper = true;
  }

  if (!isSuper) return genericResponse();

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SUPER_EMAIL_RESET_EXPIRATION_MS);
  const appUrl = resolveAppUrl(req);
  const resetLink = `${appUrl}/reset-password?token=${encodeURIComponent(
    token
  )}&email=${encodeURIComponent(email)}`;

  await db.collection("passwordResetTokens").add({
    token,
    email,
    uid: authUser.uid,
    officeId: authUser.uid,
    officeName: officeData.name || "Super Admin",
    officialName: officeData.officialName || "",
    role: "super",
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    used: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    requestTime: new Date().toISOString(),
    source: "super_admin_email_reset",
  });

  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!sendgridApiKey || !fromEmail) {
    return res.status(500).json({
      success: false,
      message:
        "Email service is not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL.",
    });
  }

  const displayName = getSuperAdminDisplayName(officeData).toUpperCase();
  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Reset Your VisiTrak Password</title>
      </head>
      <body style="margin:0;padding:0;background:#ececef;font-family:Arial,Helvetica,sans-serif;color:#202020;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ececef;padding:0;">
          <tr>
            <td align="center">
              <table role="presentation" width="500" cellspacing="0" cellpadding="0" style="max-width:500px;background:#f2f2f2;">
                <tr>
                  <td style="background:#7a4ea0;padding:28px 20px;text-align:center;">
                    <h1 style="margin:0;font-size:34px;line-height:1.1;color:#ffffff;font-weight:700;">VisiTrak</h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding:28px 24px 20px;">
                    <p style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#222;">
                      Hi <span style="color:#563480;font-weight:800;">${displayName},</span>
                    </p>

                    <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#333;">
                      You recently requested to reset your password for your VisiTrak account. To complete the reset process,
                      click the button below. This link is valid for 15 minutes.
                    </p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                      <tr>
                        <td style="background:#e9e9ed;border-left:4px solid #5B3886;border-radius:0 8px 8px 0;padding:14px 14px;">
                          <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a3a;">
                            <strong>Important:</strong> For your security, this link will expire in 15 minutes. If you don't use it
                            within that time, you'll need to request a new reset link.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
                      <tr>
                        <td>
                          <a href="${resetLink}" style="display:block;width:100%;box-sizing:border-box;background:#7a4ea0;border-radius:36px;padding:14px 16px;text-align:center;text-decoration:none;color:#ffffff;font-size:20px;line-height:1.2;font-weight:800;">
                            &#128273; RESET YOUR PASSWORD
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 22px;text-align:center;font-size:13px;line-height:1.6;color:#666;">
                      This link confirms your email address associated with your VisiTrak account.
                    </p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 14px;border:1px solid #efb93d;border-radius:8px;background:#fbf2df;">
                      <tr>
                        <td style="padding:14px 14px;">
                          <p style="margin:0 0 8px;font-size:16px;line-height:1.4;color:#e28e00;">Not you?</p>
                          <p style="margin:0;font-size:13px;line-height:1.65;color:#4d4d4d;">
                            If you didn't request a password reset, don't worry. Your email address may have been entered by mistake.
                            You can safely ignore or delete this email, and continue using your existing password to log in.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;">
                      <tr>
                        <td style="background:#e9e9ed;border-radius:3px;padding:10px 12px;text-align:center;">
                          <p style="margin:0;font-size:11px;line-height:1.2;color:#777;">Reset link valid for 15 minutes</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="background:#e6e6e9;padding:24px 22px 18px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:14px;color:#666;">Thank you for using VisiTrak,</p>
                    <p style="margin:0 0 10px;font-size:20px;color:#563480;">The VisiTrak Team</p>
                    <p style="margin:0 0 8px;font-size:11px;color:#7a7a7a;">This is an automated message, please do not reply to this email.</p>
                    <p style="margin:0;font-size:10px;color:#8a8a8a;">&copy; 2026 VisiTrak System - BISU MASID</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  sgMail.setApiKey(sendgridApiKey);
  await sgMail.send({
    to: email,
    from: {
      email: fromEmail,
      name: "VisiTrak System",
      },
      subject: "Reset Your VisiTrak Password",
      html: emailHtml,
    });

  return genericResponse();
};

const listRequests = async (req, res, admin, db) => {
  await ensureSuperRequester(admin, db, req);

  const url = new URL(req.url || "http://localhost", "http://localhost");
  const requestedStatusFilter = String(url.searchParams.get("status") || "all")
    .trim()
    .toLowerCase();
  const statusFilter = ALLOWED_STATUS_FILTERS.has(requestedStatusFilter)
    ? requestedStatusFilter
    : "all";

  const baseQuery = db.collection("passwordResetRequests");
  const requestsSnapshot =
    statusFilter === "all"
      ? await baseQuery.orderBy("requestedAt", "desc").limit(200).get()
      : await baseQuery.where("status", "==", statusFilter).limit(200).get();
  const requestDocs =
    statusFilter === "all"
      ? requestsSnapshot.docs
      : [...requestsSnapshot.docs].sort((a, b) => {
          const aData = a.data() || {};
          const bData = b.data() || {};
          const aTime =
            toDate(aData.lastUpdatedAt)?.getTime() ||
            toDate(aData.requestedAt)?.getTime() ||
            0;
          const bTime =
            toDate(bData.lastUpdatedAt)?.getTime() ||
            toDate(bData.requestedAt)?.getTime() ||
            0;
          return bTime - aTime;
        });

  const nowMs = Date.now();
  const requests = await Promise.all(
    requestDocs.map(async (doc) => {
      let data = doc.data() || {};

      if (
        (statusFilter === "all" || statusFilter === "pending") &&
        isPendingRequestExpired(data, nowMs)
      ) {
        data = await markResetRequestExpired(db, admin, doc.id, data);
      }

      return {
        id: doc.id,
        officeId: data.officeId || null,
        officeName: data.officeName || null,
        officialName: data.officialName || null,
        username: data.username || null,
        usernameNormalized: data.usernameNormalized || null,
        officeEmail: data.officeEmail || null,
        status: data.status || "pending",
        reason: data.reason || "",
        requestedAt: toIso(data.requestedAt),
        resolvedAt: toIso(data.resolvedAt),
        resolvedByUid: data.resolvedByUid || null,
        resolvedByEmail: data.resolvedByEmail || null,
        resetTokenId: data.resetTokenId || null,
        resetLink: data.resetLink || null,
        resetTokenExpiresAt: toIso(data.resetTokenExpiresAt),
        lastUpdatedAt: toIso(data.lastUpdatedAt),
      };
    })
  );

  const filteredRequests = requests.filter((request) =>
    statusFilter === "all" ? true : request.status === statusFilter
  );

  return res.status(200).json({
    success: true,
    requests: filteredRequests,
  });
};

const createRequest = async (req, res, admin, db) => {
  const identifier = normalizeIdentifier(
    req.body?.identifier || req.body?.username || ""
  );
  const requesterAddress = getRequesterAddress(req);

  // Always return generic success to avoid username enumeration.
  const genericResponse = () =>
    res.status(200).json({
      success: true,
      message:
        "If the account exists, a password reset request has been sent to the super admin.",
    });

  if (!identifier) {
    return genericResponse();
  }

  if (!canCreatePublicRequest(`${requesterAddress}:${identifier}`)) {
    return genericResponse();
  }

  const lookup = await findOfficeByIdentifier(db, identifier, admin);
  if (!lookup.officeDoc || !lookup.usernameNormalized) {
    return genericResponse();
  }

  const officeDoc = lookup.officeDoc;
  const usernameNormalized = lookup.usernameNormalized;
  const officeData = officeDoc.data() || {};
  const officeId = officeDoc.id;

  if (officeData.status === "inactive") {
    return genericResponse();
  }

  const existingRequests = await db
    .collection("passwordResetRequests")
    .where("officeId", "==", officeId)
    .limit(20)
    .get();

  const hasRecentPendingRequest = existingRequests.docs.some((doc) => {
    const data = doc.data() || {};
    if (data.status !== "pending") return false;
    const requestedAt = toDate(data.requestedAt);
    if (!requestedAt) return false;
    return Date.now() - requestedAt.getTime() < REQUEST_DEDUPE_MS;
  });

  if (hasRecentPendingRequest) {
    return genericResponse();
  }

  const requestPayload = {
    officeId,
    officeName: officeData.name || "Office",
    officialName: officeData.officialName || "",
    username: officeData.username || usernameNormalized,
    usernameNormalized,
    officeEmail: officeData.email || "",
    status: "pending",
    requestedByIp: requesterAddress,
    requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    resolvedAt: null,
    resolvedByUid: null,
    resolvedByEmail: null,
    reason: "",
    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const requestRef = await db.collection("passwordResetRequests").add(requestPayload);

  await db.collection("adminNotifications").add({
    type: "password_reset_request",
    status: "unread",
    requestId: requestRef.id,
    officeId,
    officeName: officeData.name || "Office",
    username: officeData.username || usernameNormalized,
    title: "Password reset request pending",
    message: `Office "${officeData.name || "Office"}" requested a password reset.`,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    readAt: null,
  });

  const superAdminEmails = await getSuperAdminEmails(db);
  await sendSuperAdminAlert({
    superAdminEmails,
    officeName: officeData.name || "Office",
    username: officeData.username || usernameNormalized,
  });

  return genericResponse();
};

const lookupAccount = async (req, res, admin, db) => {
  const identifier = normalizeIdentifier(
    req.body?.identifier || req.body?.username || ""
  );

  if (!identifier) {
    return res.status(200).json({
      success: true,
      exists: false,
      username: null,
      usernameNormalized: null,
      message: "No matching office account found.",
    });
  }

  const lookup = await findOfficeByIdentifier(db, identifier, admin);
  if (!lookup.officeDoc || !lookup.usernameNormalized) {
    return res.status(200).json({
      success: true,
      exists: false,
      username: null,
      usernameNormalized: null,
      message: "No matching office account found.",
    });
  }

  const officeData = lookup.officeDoc.data() || {};
  if (officeData.status === "inactive") {
    return res.status(200).json({
      success: true,
      exists: false,
      username: null,
      usernameNormalized: null,
      message: "This office account is inactive.",
    });
  }

  return res.status(200).json({
    success: true,
    exists: true,
    username: officeData.username || lookup.usernameNormalized,
    usernameNormalized: lookup.usernameNormalized,
    message: "Office account found.",
  });
};

const getLatestResetRequestForOffice = async (db, officeId) => {
  const requestsSnapshot = await db
    .collection("passwordResetRequests")
    .where("officeId", "==", officeId)
    .limit(30)
    .get();

  if (requestsSnapshot.empty) return null;

  const requests = requestsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() || {}),
  }));

  requests.sort((a, b) => {
    const aDate = toDate(a.lastUpdatedAt) || toDate(a.requestedAt) || new Date(0);
    const bDate = toDate(b.lastUpdatedAt) || toDate(b.requestedAt) || new Date(0);
    return bDate.getTime() - aDate.getTime();
  });

  return requests[0] || null;
};

const cancelPendingRequest = async (req, res, admin, db) => {
  const identifier = normalizeIdentifier(
    req.body?.identifier || req.body?.username || ""
  );
  const requestId = String(req.body?.requestId || "").trim();

  let targetRequest = null;

  if (requestId) {
    const requestSnap = await db.collection("passwordResetRequests").doc(requestId).get();
    if (requestSnap.exists) {
      targetRequest = {
        id: requestSnap.id,
        ...(requestSnap.data() || {}),
      };
    }
  }

  if (identifier) {
    const lookup = await findOfficeByIdentifier(db, identifier, admin);
    if (!lookup.officeDoc) {
      return res.status(200).json({
        success: true,
        cancelled: false,
        message: "No active reset request found to cancel.",
      });
    }

    if (targetRequest && targetRequest.officeId && targetRequest.officeId !== lookup.officeDoc.id) {
      return res.status(200).json({
        success: true,
        cancelled: false,
        message: "No active reset request found to cancel.",
      });
    }

    if (!targetRequest) {
      targetRequest = await getLatestResetRequestForOffice(db, lookup.officeDoc.id);
    }
  }

  if (!targetRequest) {
    return res.status(200).json({
      success: true,
      cancelled: false,
      message: "No active reset request found to cancel.",
    });
  }

  if (isPendingRequestExpired(targetRequest)) {
    await markResetRequestExpired(db, admin, targetRequest.id, targetRequest);
    return res.status(200).json({
      success: true,
      cancelled: false,
      status: "expired",
      requestId: targetRequest.id,
      message: "Reset request has already expired.",
    });
  }

  if ((targetRequest.status || "pending") !== "pending") {
    return res.status(200).json({
      success: true,
      cancelled: false,
      status: targetRequest.status || "none",
      requestId: targetRequest.id,
      message: "Reset request is already resolved.",
    });
  }

  await markResetRequestCancelled(db, admin, targetRequest.id, targetRequest);
  return res.status(200).json({
    success: true,
    cancelled: true,
    status: "cancelled",
    requestId: targetRequest.id,
    message: "Reset request cancelled.",
  });
};

const getRequestStatus = async (req, res, admin, db) => {
  const identifier = normalizeIdentifier(
    req.body?.identifier || req.body?.username || ""
  );
  if (!identifier) {
    return res.status(200).json({
      success: true,
      status: "none",
      message: "No password reset request found.",
    });
  }

  const lookup = await findOfficeByIdentifier(db, identifier, admin);
  if (!lookup.officeDoc) {
    return res.status(200).json({
      success: true,
      status: "none",
      message: "No password reset request found.",
    });
  }

  const officeDoc = lookup.officeDoc;
  let latestRequest = await getLatestResetRequestForOffice(db, officeDoc.id);
  if (!latestRequest) {
    return res.status(200).json({
      success: true,
      status: "none",
      message: "No password reset request found.",
    });
  }

  if (isPendingRequestExpired(latestRequest)) {
    latestRequest = await markResetRequestExpired(
      db,
      admin,
      latestRequest.id,
      latestRequest
    );
  }

  const baseResponse = {
    success: true,
    requestId: latestRequest.id || null,
    requestedAt: toIso(latestRequest.requestedAt),
    resolvedAt: toIso(latestRequest.resolvedAt),
    status: latestRequest.status || "pending",
    message: "Password reset request status fetched.",
    resetLink: null,
    expiresAt: null,
  };

  if (baseResponse.status === "cancelled") {
    return res.status(200).json({
      success: true,
      requestId: null,
      requestedAt: null,
      resolvedAt: toIso(latestRequest.resolvedAt),
      status: "none",
      message: "No password reset request found.",
      resetLink: null,
      expiresAt: null,
    });
  }

  if (baseResponse.status === "approved") {
    if (!latestRequest.resetLink) {
      return res.status(200).json({
        ...baseResponse,
        status: "pending",
        message: "Request approved. Finalizing reset link, please wait.",
      });
    }

    const expiresAt = toDate(latestRequest.resetTokenExpiresAt);
    const tokenExpired = !expiresAt || expiresAt.getTime() <= Date.now();
    let tokenUsed = false;

    if (!tokenExpired && latestRequest.resetTokenId) {
      try {
        const tokenDoc = await db
          .collection("passwordResetTokens")
          .doc(String(latestRequest.resetTokenId))
          .get();
        tokenUsed = tokenDoc.exists ? tokenDoc.data()?.used === true : true;
      } catch {
        tokenUsed = true;
      }
    }

    if (tokenExpired || tokenUsed) {
      return res.status(200).json({
        ...baseResponse,
        status: "expired",
        message: "Reset link has expired. Please submit a new request.",
      });
    }

    return res.status(200).json({
      ...baseResponse,
      status: "approved",
      message: "Your request was approved. You can reset your password now.",
      resetLink: latestRequest.resetLink || null,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    });
  }

  if (baseResponse.status === "rejected") {
    return res.status(200).json({
      ...baseResponse,
      status: "rejected",
      message: "Your request was rejected. Contact your super admin.",
    });
  }

  return res.status(200).json({
    ...baseResponse,
    status: baseResponse.status === "expired" ? "expired" : "pending",
    message:
      baseResponse.status === "expired"
        ? "Request expired. Please submit a new request."
        : "Your request is pending super admin approval.",
  });
};

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const admin = await getAdmin();
    const db = admin.firestore();

    if (req.method === "GET") {
      return await listRequests(req, res, admin, db);
    }

    if (req.method === "POST") {
      const intent = String(req.body?.intent || "").trim().toLowerCase();
      if (
        intent === "super-email-reset" ||
        intent === "super_email_reset" ||
        intent === "super-email"
      ) {
        return await createSuperEmailResetRequest(req, res, admin, db);
      }
      if (intent === "lookup") {
        return await lookupAccount(req, res, admin, db);
      }
      if (intent === "status") {
        return await getRequestStatus(req, res, admin, db);
      }
      if (intent === "cancel") {
        return await cancelPendingRequest(req, res, admin, db);
      }
      return await createRequest(req, res, admin, db);
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed.",
    });
  } catch (error) {
    console.error("office-password-reset-requests error:", error);
    const errorMessage = String(error?.message || "");
    const isQuotaError = isQuotaExceededError(error);
    const isConfigError =
      errorMessage.includes("Firebase Admin credentials") ||
      errorMessage.includes("Firebase Admin environment variables") ||
      errorMessage.includes("Invalid PEM formatted message");
    const isAuthTokenError =
      errorMessage === "Missing bearer token" ||
      errorMessage === "Invalid bearer token";
    const status =
      error.message === "Not authorized"
        ? 403
        : isAuthTokenError
          ? 401
          : isQuotaError
            ? 503
            : 500;
    return res.status(status).json({
      success: false,
      message:
        status === 401
          ? "Session token is invalid for the server Firebase project. Sign out and sign in again. If it persists, client Firebase config and server Admin credentials may be pointing to different projects."
          : status === 403
          ? "Not authorized."
          : status === 503
            ? "Firestore quota is temporarily exhausted. Please wait and try again."
          : isConfigError
            ? "Server Firebase Admin configuration is invalid. Please check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY on Vercel."
            : "Failed to process reset request.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
