import sgMail from '@sendgrid/mail';
import crypto from 'crypto';
import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    // Get private key and replace escaped newlines
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    let formattedKey = privateKey;
    
    // Handle different newline formats
    if (privateKey.includes('\\n')) {
      formattedKey = privateKey.replace(/\\n/g, '\n');
    }
    
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedKey,
      }),
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
    console.error('Project ID:', process.env.FIREBASE_PROJECT_ID);
    console.error('Client Email:', process.env.FIREBASE_CLIENT_EMAIL);
    console.error('Private Key length:', process.env.FIREBASE_PRIVATE_KEY?.length);
  }
}

const db = admin.firestore();

// Configure SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('SendGrid configured');
} else {
  console.error('SENDGRID_API_KEY is not set');
}

export default async function handler(req, res) {
  console.log('API called with method:', req.method);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return res.status(200).end();
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({
      success: false,
      message: 'Method Not Allowed. Use POST method.'
    });
  }

  try {
    const { email } = req.body;
    console.log('Request body:', req.body);

    if (!email) {
      console.log('No email provided');
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log('Processing password reset for:', normalizedEmail);

    // Check if Firebase is initialized
    if (!admin.apps.length) {
      throw new Error('Firebase Admin not initialized');
    }

    // Check if email exists in Firestore
    console.log('Checking email in Firestore...');
    const officesRef = db.collection('offices');
    const snapshot = await officesRef.where('email', '==', normalizedEmail).get();

    console.log('Query result size:', snapshot.size);
    if (snapshot.empty) {
      console.log('Email not found:', normalizedEmail);
      return res.status(404).json({
        success: false,
        message: 'Email not registered in the system'
      });
    }

    // Generate reset token
    console.log('Generating reset token...');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save token to Firestore
    console.log('Saving token to Firestore...');
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
    console.log('Reset link created:', resetLink);

    // Send email via SendGrid
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SENDGRID_API_KEY not set, simulating email send');
      console.log('Simulated reset link:', resetLink);
      
      return res.status(200).json({
        success: true,
        message: 'Password reset token generated (SendGrid not configured)',
        resetLink: resetLink, // For testing only
        token: token // For testing only
      });
    }

    console.log('Sending email via SendGrid...');
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
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px;">
            <div style="background: linear-gradient(135deg, #5B3886, #8B5AA8); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">VisiTrak Password Reset</h1>
            </div>
            <div style="padding: 30px;">
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
              <p>If you did not request a password reset, please ignore this email.</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
                <p>If the button doesn't work, copy and paste this link:</p>
                <p style="background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">
                  ${resetLink}
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await sgMail.send(msg);
    console.log('Password reset email sent to:', normalizedEmail);

    return res.status(200).json({
      success: true,
      message: 'Password reset email sent successfully'
    });

  } catch (error) {
    console.error('Send password reset error:', error);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to send password reset email',
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
  }
}