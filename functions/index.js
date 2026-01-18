const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

exports.sendPasswordReset = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).send('');
  }

  // Only allow POST
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
    console.log(`Password reset requested for: ${normalizedEmail}`);

    // Check if email exists in Firestore
    const officesRef = db.collection('offices');
    const snapshot = await officesRef.where('email', '==', normalizedEmail).get();
    
    if (snapshot.empty) {
      return res.status(404).json({ 
        success: false,
        message: 'Email not found in system' 
      });
    }

    // Generate reset token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    // Save token to Firestore
    await db.collection('passwordResetTokens').add({
      email: normalizedEmail,
      token: token,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      used: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Get SendGrid config from environment
    const sendgridApiKey = process.env.SENDGRID_API_KEY || functions.config().sendgrid?.key;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || functions.config().sendgrid?.from_email;
    const appUrl = process.env.APP_URL || functions.config().app?.url || 'https://visitrak-system.vercel.app';

    if (!sendgridApiKey) {
      console.error('SendGrid API key not configured');
      // For development/testing, return the reset link
      const resetLink = `${appUrl}/reset-password?token=${token}`;
      console.log('DEV MODE - Reset link:', resetLink);
      
      return res.status(200).json({
        success: true,
        message: 'Reset token generated (SendGrid not configured)',
        resetLink: resetLink, // Only in dev mode
        token: token // Only in dev mode
      });
    }

    // Configure SendGrid
    sgMail.setApiKey(sendgridApiKey);

    // Create reset link
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    // Send email
    const msg = {
      to: normalizedEmail,
      from: fromEmail,
      subject: 'Reset Your VisiTrak Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #5B3886, #8B5AA8); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">VisiTrak Password Reset</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px; border: 1px solid #eee;">
            <p>Hello,</p>
            <p>You recently requested to reset your password for your VisiTrak account. Click the button below to reset it.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" 
                 style="background: #5B3886; color: white; padding: 14px 28px; 
                        text-decoration: none; border-radius: 8px; font-weight: bold;
                        display: inline-block; font-size: 16px;">
                Reset Password
              </a>
            </div>
            
            <p>This password reset link will expire in <strong>15 minutes</strong>.</p>
            <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
              <p>If you're having trouble clicking the button, copy and paste the URL below into your web browser:</p>
              <p style="background: #f0f0f0; padding: 10px; border-radius: 4px; word-break: break-all;">
                ${resetLink}
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await sgMail.send(msg);
    console.log(`Password reset email sent to ${normalizedEmail}`);

    return res.status(200).json({
      success: true,
      message: 'Password reset email sent successfully'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
});