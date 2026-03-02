import { randomBytes } from "crypto";
import sgMail from "@sendgrid/mail";
import { getAdmin } from "../server/firebaseAdmin.js";

const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_EXPIRES_MS = 15 * 60 * 1000;
const normalizeEmail = (email = "") => String(email || "").trim().toLowerCase();

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

const genericSuccess = (res) =>
  res.status(200).json({
    success: true,
    message:
      "If this email is registered, a password reset link has been sent. Please check your inbox.",
  });

const getDisplayName = (officeData = {}) => {
  const value = String(
    officeData.officialName || officeData.name || "SCHOOL ADMIN"
  ).trim();
  return value || "SCHOOL ADMIN";
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
    const email = normalizeEmail(req.body?.email || "");
    if (!EMAIL_REGEX.test(email)) {
      return genericSuccess(res);
    }

    const admin = await getAdmin();
    const db = admin.firestore();

    let authUser = null;
    try {
      authUser = await admin.auth().getUserByEmail(email);
    } catch (error) {
      if (String(error?.code || "") === "auth/user-not-found") {
        return genericSuccess(res);
      }
      throw error;
    }

    if (!authUser?.uid) return genericSuccess(res);

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
        return genericSuccess(res);
      }
      officeData = superDoc.data() || {};
      isSuper = true;
    }

    if (!isSuper) return genericSuccess(res);

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_EXPIRES_MS);
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

    sgMail.setApiKey(sendgridApiKey);
    await sgMail.send({
      to: email,
      from: {
        email: fromEmail,
        name: "VisiTrak System",
      },
      subject: "Reset Your VisiTrak Password",
      html: `
        <div style="font-family:Arial,sans-serif;color:#222;line-height:1.6">
          <h2 style="margin:0 0 12px;color:#5B3886">VisiTrak Password Reset</h2>
          <p style="margin:0 0 10px;">Hi ${getDisplayName(officeData)},</p>
          <p style="margin:0 0 14px;">
            You requested to reset your password. This link is valid for 15 minutes.
          </p>
          <p style="margin:0 0 16px;">
            <a href="${resetLink}" style="background:#5B3886;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;display:inline-block;font-weight:700;">
              Reset Your Password
            </a>
          </p>
          <p style="margin:0 0 6px;font-size:12px;color:#666;word-break:break-all;">
            ${resetLink}
          </p>
          <p style="margin:0;font-size:12px;color:#666;">
            If you did not request this, you may ignore this email.
          </p>
        </div>
      `,
    });

    return genericSuccess(res);
  } catch (error) {
    console.error("super-password-reset-email error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send password reset email.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
