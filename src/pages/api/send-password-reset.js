// pages/api/send-password-reset.js
import sgMail from "@sendgrid/mail";
import crypto from "crypto";
import admin from "firebase-admin";

// =============================
// Firebase Admin Init
// =============================
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  } catch (error) {
    console.error("Firebase admin initialization error:", error);
  }
}

const db = admin.firestore();

// =============================
// SendGrid Setup
// =============================
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.error("SENDGRID_API_KEY is not set");
}

// =============================
// API Handler
// =============================
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      message: 'Method Not Allowed',
      allowed: ['POST'] 
    });
  }

  try {
    console.log("API called with method:", req.method);
    console.log("Request body:", req.body);

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: "Email is required" 
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log("Processing email:", normalizedEmail);

    // =============================
    // Check if email exists
    // =============================
    console.log("Checking email in Firestore...");
    const officeSnap = await db
      .collection("offices")
      .where("email", "==", normalizedEmail)
      .get();

    if (officeSnap.empty) {
      console.log("Email not found:", normalizedEmail);
      return res.status(404).json({ 
        success: false,
        message: "Email not registered" 
      });
    }

    console.log("Email found, generating token...");

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
    const appUrl = process.env.APP_URL || "https://visitrak-system.vercel.app";
    const resetLink = `${appUrl}/reset-password?token=${token}`;
    console.log("Reset link generated:", resetLink);

    // =============================
    // Send email
    // =============================
    if (!process.env.SENDGRID_API_KEY) {
      console.warn("SENDGRID_API_KEY not set, simulating email send");
      // For testing, log the reset link
      console.log("TEST MODE - Reset link:", resetLink);
    } else {
      console.log("Sending email via SendGrid...");
      await sgMail.send({
        to: normalizedEmail,
        from: process.env.SENDGRID_FROM_EMAIL || "noreply@visitrak.com",
        subject: "Reset Your VisiTrak Password",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #5B3886, #8B5AA8); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">VisiTrak Password Reset</h1>
            </div>
            <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
              <p>Hello,</p>
              <p>You requested to reset your VisiTrak password.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" 
                   style="background: #5B3886; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 5px; font-weight: bold;
                          display: inline-block;">
                  Reset Password
                </a>
              </div>
              <p>This link will expire in <strong>15 minutes</strong>.</p>
              <p>If you did not request this password reset, please ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
              <p style="color: #666; font-size: 12px;">
                If the button above doesn't work, copy and paste this link into your browser:<br>
                <code style="background: #eee; padding: 5px; border-radius: 3px; word-break: break-all;">
                  ${resetLink}
                </code>
              </p>
            </div>
          </div>
        `,
      });
      console.log("Email sent successfully");
    }

    // =============================
    // Success response
    // =============================
    return res.status(200).json({ 
      success: true,
      message: "Password reset email sent successfully"
    });

  } catch (error) {
    console.error("Send password reset error:", error);
    
    return res.status(500).json({ 
      success: false,
      message: error.message || "Internal Server Error",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Disable body parser to handle raw body if needed
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};