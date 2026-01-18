import sgMail from "@sendgrid/mail";
import crypto from "crypto";
import admin from "firebase-admin";

// =============================
// Firebase Admin Init
// =============================
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

// =============================
// SendGrid Setup
// =============================
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// =============================
// API Handler
// =============================
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // =============================
    // Check if email exists
    // =============================
    const officeSnap = await db
      .collection("offices")
      .where("email", "==", normalizedEmail)
      .get();

    if (officeSnap.empty) {
      return res.status(404).json({ message: "Email not registered" });
    }

    // =============================
    // Generate token
    // =============================
    const token = crypto.randomUUID();
    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 15 * 60 * 1000)
    );

    // =============================
    // Save token
    // =============================
    await db.collection("passwordResetTokens").add({
      email: normalizedEmail,
      token,
      expiresAt,
      used: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // =============================
    // Reset link
    // =============================
    const resetLink = `${process.env.APP_URL}/reset-password?token=${token}`;

    // =============================
    // Send email
    // =============================
    await sgMail.send({
      to: normalizedEmail,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: "Reset Your VisiTrak Password",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Password Reset Request</h2>
          <p>You requested to reset your VisiTrak password.</p>
          <p>
            <a href="${resetLink}" style="color:#5B3886;font-weight:bold;">
              Reset Password
            </a>
          </p>
          <p>This link will expire in 15 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Send password reset error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
