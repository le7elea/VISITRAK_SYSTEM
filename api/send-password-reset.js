import sgMail from '@sendgrid/mail';
import crypto from 'crypto';
import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

const db = admin.firestore();

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
      success: false,
      message: 'Method Not Allowed. Use POST method.'
    });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log('Password reset requested for:', normalizedEmail);

    // Check if email exists in Firestore
    const officesRef = db.collection('offices');
    const snapshot = await officesRef.where('email', '==', normalizedEmail).get();

    if (snapshot.empty) {
      return res.status(404).json({
        success: false,
        message: 'Email not registered in the system'
      });
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save token to Firestore
    await db.collection('passwordResetTokens').add({
      email: normalizedEmail,
      token,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      used: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create reset link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://visitrak-system.vercel.app';
    const resetLink = `${appUrl}/reset-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;

    // Send email via SendGrid
    const msg = {
      to: normalizedEmail,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: 'Reset Your VisiTrak Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
            .header { background: linear-gradient(135deg, #5B3886, #8B5AA8); padding: 30px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .button { background: #5B3886; color: white; padding: 14px 28px; text-decoration: none; 
                     border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
            .code { background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>VisiTrak Password Reset</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>You recently requested to reset your password for your VisiTrak account. Click the button below to reset it.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" class="button">
                  Reset Password
                </a>
              </div>
              
              <p>This password reset link will expire in <strong>15 minutes</strong>.</p>
              <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
              
              <div class="footer">
                <p>If the button above doesn't work, copy and paste the URL below into your web browser:</p>
                <p class="code">${resetLink}</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Reset your VisiTrak password by visiting: ${resetLink}\n\nThis link expires in 15 minutes.`,
    };

    await sgMail.send(msg);
    console.log('Password reset email sent to:', normalizedEmail);

    return res.status(200).json({
      success: true,
      message: 'Password reset email sent successfully'
    });

  } catch (error) {
    console.error('Send password reset error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to send password reset email',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}