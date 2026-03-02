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

const toDisplayName = (officeData = {}, email = "") => {
  const candidate =
    String(officeData.officialName || officeData.name || "").trim() ||
    String(email || "").split("@")[0] ||
    "School Admin";
  return candidate.toUpperCase();
};

const buildHtmlTemplate = ({ displayName, resetLink }) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VisiTrak Password Reset</title>
  </head>
  <body style="margin:0;padding:0;background:#f2f3f7;font-family:Arial,Helvetica,sans-serif;color:#222;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="760" cellspacing="0" cellpadding="0" style="max-width:760px;background:#ffffff;border-radius:0;overflow:hidden;">
            <tr>
              <td style="background:#6f4a97;padding:36px 24px;text-align:center;">
                <div style="font-size:52px;line-height:1;color:#fff;font-weight:800;letter-spacing:.5px;">VisiTrak</div>
              </td>
            </tr>

            <tr>
              <td style="padding:42px 40px 24px;">
                <p style="margin:0 0 24px;font-size:42px;line-height:1.2;font-weight:500;color:#1f1f1f;">
                  Hi <span style="font-weight:800;color:#5B3886;">${displayName},</span>
                </p>

                <p style="margin:0 0 26px;font-size:16px;line-height:1.7;color:#333;">
                  You recently requested to reset your password for your VisiTrak account.
                  To complete the reset process, click the button below. This link is valid for 15 minutes.
                </p>

                <div style="margin:0 0 30px;background:#f3f3f5;border-left:4px solid #6f4a97;padding:18px 20px;">
                  <p style="margin:0;font-size:16px;line-height:1.6;color:#434343;">
                    <strong>Important:</strong> For your security, this link will expire in 15 minutes.
                    If you don't use it within that time, you'll need to request a new reset link.
                  </p>
                </div>

                <div style="text-align:center;margin:36px 0 34px;">
                  <a
                    href="${resetLink}"
                    style="display:inline-block;background:#6f4a97;color:#0e47b8;text-decoration:none;font-weight:800;font-size:36px;line-height:1;border-radius:40px;padding:24px 44px;min-width:560px;text-align:center;"
                  >
                    RESET YOUR PASSWORD
                  </a>
                </div>

                <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#666;">
                  This link confirms your email address associated with your VisiTrak account.
                </p>
                <p style="margin:0;font-size:14px;line-height:1.7;color:#666;word-break:break-all;">
                  If the button does not work, copy and paste this URL into your browser:<br />
                  <a href="${resetLink}" style="color:#5B3886;">${resetLink}</a>
                </p>
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
    if (!email || !EMAIL_REGEX.test(email)) {
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

    const byUid = await db.collection("offices").doc(authUser.uid).get();
    const byUidData = byUid.exists ? byUid.data() || {} : {};
    const byUidIsSuper = (byUidData.role || "").toLowerCase() === "super";

    let superDoc = byUid;
    let superData = byUidData;

    if (!byUidIsSuper) {
      const byEmailQuery = await db
        .collection("offices")
        .where("email", "==", email)
        .limit(5)
        .get();

      const matched = byEmailQuery.docs.find(
        (doc) => (doc.data()?.role || "").toLowerCase() === "super"
      );

      if (!matched) {
        return genericSuccess(res);
      }

      superDoc = matched;
      superData = matched.data() || {};
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
      officeId: superDoc?.id || null,
      officeName: superData?.name || "Super Admin",
      officialName: superData?.officialName || "",
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
      subject: "VisiTrak Password Reset",
      html: buildHtmlTemplate({
        displayName: toDisplayName(superData, email),
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
