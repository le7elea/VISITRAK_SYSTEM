import sgMail from '@sendgrid/mail';

// Configure SendGrid at module level
const SENDGRID_CONFIGURED = !!process.env.SENDGRID_API_KEY && !!process.env.SENDGRID_FROM_EMAIL;

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid API key configured');
}

export default async function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // GET: Health check endpoint
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'Password Reset API is running',
      status: 'operational',
      config: {
        sendGridConfigured: SENDGRID_CONFIGURED,
        sendGridApiKey: !!process.env.SENDGRID_API_KEY,
        sendGridFromEmail: !!process.env.SENDGRID_FROM_EMAIL,
        firebaseConfigured: !!(process.env.FIREBASE_PROJECT_ID && 
                                process.env.FIREBASE_CLIENT_EMAIL && 
                                process.env.FIREBASE_PRIVATE_KEY)
      },
      timestamp: new Date().toISOString()
    });
  }
  
  // Only allow POST for password reset
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST.'
    });
  }
  
  // ========== POST: Process Password Reset ==========
  try {
    const { email } = req.body;
    
    // Validate email input
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required',
        error: 'INVALID_INPUT'
      });
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
        error: 'INVALID_EMAIL_FORMAT'
      });
    }
    
    console.log(`\n📧 Password reset request for: ${normalizedEmail}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    
    // Check Firebase Admin availability
    const hasFirebaseAdmin = !!(
      process.env.FIREBASE_PRIVATE_KEY && 
      process.env.FIREBASE_CLIENT_EMAIL && 
      process.env.FIREBASE_PROJECT_ID
    );
    
    let officeData = null;
    let token = null;
    let expiresAt = null;
    let tokenSaved = false;
    let officeId = null;
    let officeName = null;
    let officialName = null;
    
    // ========== Firebase Admin: Validate Email & Save Token ==========
    if (hasFirebaseAdmin) {
      try {
        console.log('🔥 Initializing Firebase Admin...');
        const { default: admin } = await import('firebase-admin');
        
        // Initialize Firebase Admin if needed
        if (!admin.apps.length) {
          let privateKey = process.env.FIREBASE_PRIVATE_KEY;
          
          // Handle escaped newlines in private key
          if (privateKey && privateKey.includes('\\n')) {
            privateKey = privateKey.replace(/\\n/g, '\n');
          }
          
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: privateKey,
            }),
          });
          console.log('✅ Firebase Admin initialized');
        }
        
        const db = admin.firestore();
        
        // Check if email exists in offices collection
        console.log('🔍 Searching for email in offices collection...');
        const officesSnapshot = await db
          .collection('offices')
          .where('email', '==', normalizedEmail)
          .limit(1)
          .get();
        
        if (officesSnapshot.empty) {
          console.log('❌ Email not found in database');
          return res.status(404).json({
            success: false,
            message: 'This email is not registered in the VisiTrak system',
            email: normalizedEmail,
            error: 'EMAIL_NOT_FOUND'
          });
        }
        
        // Get office data
        const officeDoc = officesSnapshot.docs[0];
        officeData = officeDoc.data();
        officeId = officeDoc.id;
        officeName = officeData.name || 'Unknown Office';
        officialName = officeData.officialName || '';
        
        console.log('✅ Email found:', {
          officeId,
          email: officeData.email,
          name: officeName,
          officialName: officialName
        });
        
        // Generate secure reset token - use hex for simpler URL encoding
        const crypto = await import('crypto');
        token = crypto.randomBytes(32).toString('hex'); // Simple hex string
        
        expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        
        console.log('🔐 Generated reset token:', token.substring(0, 20) + '...');
        console.log('⏳ Token expires at:', expiresAt.toISOString());
        
        // Save token to Firestore with ALL required fields
        console.log('💾 Saving token to Firestore...');
        const tokenData = {
          email: normalizedEmail,
          token: token, // Store plain token
          officeId: officeId,
          officeName: officeName,
          officialName: officialName,
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          used: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          requestTime: new Date().toISOString(),
          ipAddress: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown'
        };
        
        const tokenRef = await db.collection('passwordResetTokens').add(tokenData);
        const tokenId = tokenRef.id;
        
        tokenSaved = true;
        console.log('✅ Token saved successfully:', {
          tokenId,
          email: normalizedEmail,
          officeName,
          used: false,
          expiresAt: expiresAt.toISOString()
        });
        
      } catch (firebaseError) {
        console.error('❌ Firebase error:', firebaseError.message);
        console.error('Stack:', firebaseError.stack);
        
        // Return specific Firebase errors
        if (firebaseError.code === 16 || firebaseError.message.includes('UNAUTHENTICATED')) {
          return res.status(401).json({
            success: false,
            message: 'Database authentication failed',
            error: 'FIREBASE_AUTH_FAILED',
            details: 'Please check Firebase credentials'
          });
        }
        
        if (firebaseError.code === 'permission-denied') {
          return res.status(403).json({
            success: false,
            message: 'Database permission denied',
            error: 'FIREBASE_PERMISSION_DENIED',
            details: 'Check Firestore security rules'
          });
        }
        
        // For other Firebase errors, fall back to simple mode
        console.log('⚠️ Falling back to simple mode (no token persistence)');
        officeData = { name: 'Office', email: normalizedEmail };
        officeName = 'Office';
        officialName = '';
        const crypto = await import('crypto');
        token = crypto.randomBytes(32).toString('hex');
        expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        tokenSaved = false;
      }
    } else {
      // No Firebase Admin - simple token generation
      console.log('⚠️ Firebase Admin not configured - using simple mode');
      officeData = { name: 'Office', email: normalizedEmail };
      officeName = 'Office';
      officialName = '';
      const crypto = await import('crypto');
      token = crypto.randomBytes(32).toString('hex');
      expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      tokenSaved = false;
    }
    
    // Generate reset link - IMPORTANT: Use encodeURIComponent for email only
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://visitrak-system.vercel.app';
    const resetLink = `${appUrl}/reset-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;
    
    console.log('🔗 Reset link generated:', {
      token: token.substring(0, 20) + '...',
      email: normalizedEmail,
      resetLink: resetLink
    });
    
    // ========== Check SendGrid Configuration ==========
    if (!SENDGRID_CONFIGURED) {
      console.warn('⚠️ SendGrid not fully configured');
      
      if (!process.env.SENDGRID_API_KEY) {
        console.error('❌ Missing SENDGRID_API_KEY');
      }
      if (!process.env.SENDGRID_FROM_EMAIL) {
        console.error('❌ Missing SENDGRID_FROM_EMAIL');
      }
      
      // Return development mode response
      return res.status(200).json({
        success: true,
        message: 'Password reset token generated (development mode)',
        mode: 'development',
        email: normalizedEmail,
        office: officeName,
        officialName: officialName,
        resetLink: resetLink,
        token: token, // Include full token for testing
        expiresAt: expiresAt.toISOString(),
        tokenSaved: tokenSaved,
        warning: 'Email not sent - configure SENDGRID_API_KEY and SENDGRID_FROM_EMAIL',
        nextSteps: [
          'Add SENDGRID_API_KEY to Vercel environment variables',
          'Add SENDGRID_FROM_EMAIL to Vercel environment variables',
          'Redeploy the application'
        ]
      });
    }
    
    // ========== Send Email via SendGrid ==========
    console.log('📤 Preparing to send email...');
    console.log(`   To: ${normalizedEmail}`);
    console.log(`   From: ${process.env.SENDGRID_FROM_EMAIL}`);
    console.log(`   Reset Link: ${resetLink.substring(0, 80)}...`);
    
    const emailMessage = {
      to: normalizedEmail,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: 'VisiTrak System'
      },
      subject: 'Reset Your VisiTrak Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset - VisiTrak</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #5B3886, #8B5AA8); padding: 30px; text-align: center;">
                      <h1 style="color: white; margin: 0; font-size: 24px;">🔒 VisiTrak Password Reset</h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 30px;">
                      <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;"><strong>Hello,</strong></p>
                      <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 0 0 20px 0;">
                        You recently requested to reset your password for your VisiTrak account.
                      </p>
                      
                      <!-- Office Info Box -->
                      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #5B3886; margin: 20px 0;">
                        <p style="margin: 0 0 8px 0; font-size: 14px; color: #333;"><strong>Account Details:</strong></p>
                        <p style="margin: 4px 0; font-size: 13px; color: #666;">📧 Email: ${normalizedEmail}</p>
                        <p style="margin: 4px 0; font-size: 13px; color: #666;">🏢 Office: ${officeName}</p>
                        ${officialName ? `<p style="margin: 4px 0; font-size: 13px; color: #666;">👤 Official Name: ${officialName}</p>` : ''}
                      </div>
                      
                      <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 20px 0;">
                        Click the button below to reset your password:
                      </p>
                      
                      <!-- Button -->
                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #5B3886; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
                          🔑 Reset Password
                        </a>
                      </div>
                      
                      <!-- Warning Box -->
                      <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0 0 8px 0; font-size: 14px; color: #856404;"><strong>⚠️ Important:</strong></p>
                        <p style="margin: 4px 0; font-size: 13px; color: #856404;">• This link will expire in <strong>15 minutes</strong></p>
                        <p style="margin: 4px 0; font-size: 13px; color: #856404;">• If you didn't request this, please ignore this email</p>
                        <p style="margin: 4px 0; font-size: 13px; color: #856404;">• For security, this link can only be used once</p>
                      </div>
                      
                      <!-- Footer -->
                      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                        <p style="font-size: 12px; color: #999; margin: 0 0 10px 0;">
                          If the button doesn't work, copy and paste this link into your browser:
                        </p>
                        <p style="font-size: 11px; color: #666; background-color: #f8f9fa; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace;">
                          ${resetLink}
                        </p>
                        <p style="font-size: 11px; color: #999; margin: 20px 0 0 0; text-align: center;">
                          © 2025 VisiTrak System - BISU MASID. All rights reserved.
                        </p>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `
VisiTrak Password Reset

Hello,

You recently requested to reset your password for your VisiTrak account.

Account Details:
- Email: ${normalizedEmail}
- Office: ${officeName}
${officialName ? `- Official Name: ${officialName}` : ''}

Reset your password by clicking this link:
${resetLink}

IMPORTANT:
• This link will expire in 15 minutes
• If you didn't request this, please ignore this email
• For security, this link can only be used once

---
© 2025 VisiTrak System - BISU MASID
      `.trim()
    };
    
    try {
      console.log('📮 Sending email via SendGrid...');
      const sendGridResponse = await sgMail.send(emailMessage);
      
      const statusCode = sendGridResponse[0]?.statusCode;
      const messageId = sendGridResponse[0]?.headers?.['x-message-id'];
      
      console.log('✅ SendGrid Response:');
      console.log(`   Status Code: ${statusCode}`);
      console.log(`   Message ID: ${messageId || 'N/A'}`);
      
      if (statusCode === 202) {
        console.log('✅ Email accepted for delivery by SendGrid');
        
        return res.status(200).json({
          success: true,
          message: 'Password reset email sent successfully',
          email: normalizedEmail,
          office: officeName,
          officialName: officialName,
          expiresAt: expiresAt.toISOString(),
          messageId: messageId,
          tokenSaved: tokenSaved,
          note: 'Please check your inbox and spam folder for the reset link'
        });
      } else {
        console.warn(`⚠️ Unexpected status code from SendGrid: ${statusCode}`);
        throw new Error(`Unexpected SendGrid response: ${statusCode}`);
      }
      
    } catch (sendGridError) {
      console.error('❌ SendGrid Error:', sendGridError.message);
      
      // Log detailed error information
      if (sendGridError.response) {
        console.error('   Status Code:', sendGridError.response?.statusCode);
        console.error('   Error Body:', JSON.stringify(sendGridError.response?.body));
      }
      
      // Handle specific SendGrid errors
      let errorMessage = 'Failed to send password reset email';
      let errorCode = 'EMAIL_SEND_FAILED';
      
      if (sendGridError.code === 403 || sendGridError.response?.statusCode === 403) {
        errorMessage = 'Email service authentication failed. Sender email may not be verified.';
        errorCode = 'SENDGRID_AUTH_FAILED';
      } else if (sendGridError.code === 400 || sendGridError.response?.statusCode === 400) {
        errorMessage = 'Invalid email configuration. Please contact support.';
        errorCode = 'SENDGRID_INVALID_CONFIG';
      } else if (sendGridError.message?.includes('Sender')) {
        errorMessage = 'Sender email address is not verified. Please contact support.';
        errorCode = 'SENDER_NOT_VERIFIED';
      }
      
      return res.status(500).json({
        success: false,
        message: errorMessage,
        error: errorCode,
        details: process.env.NODE_ENV === 'development' ? sendGridError.message : undefined,
        troubleshooting: [
          'Verify sender email in SendGrid dashboard',
          'Check SENDGRID_API_KEY is correct',
          'Ensure SENDGRID_FROM_EMAIL matches verified sender'
        ]
      });
    }
    
  } catch (error) {
    console.error('❌ Unexpected Error:', error.message);
    console.error('Stack:', error.stack);
    
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while processing your request',
      error: 'INTERNAL_SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}