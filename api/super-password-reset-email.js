import { randomBytes } from "crypto";
import sgMail from "@sendgrid/mail";
import { getAdmin } from "../server/firebaseAdmin.js";

const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const normalizeEmail = (email = "") => String(email || "").trim().toLowerCase();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_EXPIRES_MS = 15 * 60 * 1000;

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
  const candidate = String(
    officeData.officialName || officeData.name || "SCHOOL ADMIN"
  )
    .trim()
    .toUpperCase();
  return candidate || "SCHOOL ADMIN";
};

const buildEmailHtml = ({ displayName, resetLink }) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VisiTrak Password Reset</title>
  </head>
  <body style="margin:0;padding:0;background:#eef0f4;font-family:Arial,Helvetica,sans-serif;color:#1f1f1f;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:18px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="760" cellspacing="0" cellpadding="0" style="max-width:760px;background:#f8f8fb;">
            <tr>
              <td style="padding:0 12px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:10px 10px 0 0;overflow:hidden;">
                  <tr>
                    <td style="background:#6f4a97;text-align:center;padding:48px 24px;">
                      <div style="font-size:48px;line-height:1;color:#ffffff;font-weight:700;letter-spacing:.3px;">VisiTrak</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:22px 24px 14px;">
                <p style="margin:0 0 20px;font-size:40px;line-height:1.2;color:#222;font-weight:400;">
                  Hi <span style="color:#5B3886;font-weight:800;">${displayName},</span>
                </p>

                <p style="margin:0 0 24px;font-size:16px;line-height:1.8;color:#333;">
                  You recently requested to reset your password for your VisiTrak account.
                  To complete the reset process, click the button below. This link is valid for 15 minutes.
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;">
                  <tr>
                    <td style="background:#ececf1;border-left:4px solid #6f4a97;border-radius:0 8px 8px 0;padding:14px 16px;">
                      <p style="margin:0;font-size:14px;line-height:1.65;color:#333;">
                        <strong>Important:</strong> For your security, this link will expire in 15 minutes.
                        If you don't use it within that time, you'll need to request a new reset link.
                      </p>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;">
                  <tr>
                    <td align="center">
                      <a href="${resetLink}" style="display:block;background:#6f4a97;border-radius:40px;text-decoration:none;padding:18px 20px;color:#0f55c8;font-size:40px;font-weight:800;line-height:1.1;">
                        &#128273; RESET YOUR PASSWORD
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 16px;font-size:13px;line-height:1.7;text-align:center;color:#666;">
                  This link confirms your email address associated with your VisiTrak account.
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 14px;border:1px solid #e0b853;border-radius:8px;background:#f8f0dc;">
                  <tr>
                    <td style="padding:14px 16px;">
                      <p style="margin:0 0 8px;color:#d48700;font-size:16px;line-height:1.4;">Not you?</p>
                      <p style="margin:0;color:#4a4a4a;font-size:13px;line-height:1.7;">
                        If you didn't request a password reset, don't worry. Your email address may have been entered by mistake.
                        You can safely ignore or delete this email, and continue using your existing password to log in.
                      </p>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="background:#ececf1;color:#777;font-size:11px;text-align:center;padding:10px 12px;border-radius:3px;">
                      Reset link valid for 15 minutes
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

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

    if (!authUser?.uid) {
      return genericSuccess(res);
    }

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

    if (!isSuper) {
      return genericSuccess(res);
    }

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
      html: buildEmailHtml({
        displayName: getDisplayName(officeData),
        resetLink,
      }),
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
