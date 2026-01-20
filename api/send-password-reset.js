// /api/send-password-reset.js
import sgMail from '@sendgrid/mail';

// Try to import firebase-admin, but handle gracefully if not available
let admin;
let db;
let hasFirebaseAdmin = false;

async function initializeFirebaseAdmin() {
  try {
    // Dynamic import to handle missing dependency
    const firebaseAdminModule = await import('firebase-admin');
    admin = firebaseAdminModule.default;
    hasFirebaseAdmin = true;
    
    // Only initialize if not already initialized
    if (!admin.apps.length) {
      // Get and format private key
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      let formattedKey = privateKey;
      
      // Replace escaped newlines with actual newlines
      if (privateKey && privateKey.includes('\\n')) {
        formattedKey = privateKey.replace(/\\n/g, '\n');
      }
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: formattedKey,
        }),
      });
      console.log('✅ Firebase Admin initialized successfully');
    }
    
    db = admin.firestore();
    return true;
    
  } catch (error) {
    console.warn('⚠️ Firebase Admin initialization failed:', error.message);
    console.warn('💡 To fix: npm install firebase-admin');
    return false;
  }
}

// Initialize Firebase Admin (async but we don't await - it will initialize in background)
initializeFirebaseAdmin().then(success => {
  if (success) {
    console.log('✅ Firebase Admin ready');
  } else {
    console.log('⚠️ Running in simulation mode');
  }
});

// Configure SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid configured');
} else {
  console.warn('⚠️ SENDGRID_API_KEY not set');
}

export default async function handler(req, res) {
  console.log(`📨 API ${req.method} request to ${req.url}`);
  
  // ========== CORS Headers ==========
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // ========== Handle Preflight Requests ==========
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling OPTIONS preflight request');
    return res.status(200).end();
  }
  
  // ========== GET Request - API Status Check ==========
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'VisiTrak Password Reset API',
      status: 'operational',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'production',
      capabilities: {
        firebaseAdmin: hasFirebaseAdmin,
        sendGrid: !!process.env.SENDGRID_API_KEY,
        firebaseConfig: !!process.env.FIREBASE_PROJECT_ID,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://visitrak-system.vercel.app'
      },
      endpoints: {
        passwordReset: 'POST /api/send-password-reset',
        status: 'GET /api/send-password-reset'
      },
      timestamp: new Date().toISOString()
    });
  }
  
  // ========== POST Request - Process Password Reset ==========
  if (req.method === 'POST') {
    try {
      console.log('📝 Processing password reset request');
      
      // Parse request body
      let body;
      try {
        body = req.body;
        // Handle case where body might be a string
        if (typeof body === 'string') {
          body = JSON.parse(body);
        }
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        return res.status(400).json({
          success: false,
          message: 'Invalid JSON in request body',
          error: 'JSON_PARSE_ERROR'
        });
      }
      
      const { email } = body;
      
      // Validate email
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email address is required',
          error: 'EMAIL_REQUIRED'
        });
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address',
          error: 'INVALID_EMAIL'
        });
      }
      
      const normalizedEmail = email.trim().toLowerCase();
      console.log(`📧 Processing request for: ${normalizedEmail}`);
      
      // ========== MODE 1: Simulation (firebase-admin not installed) ==========
      if (!hasFirebaseAdmin) {
        console.log('🎭 Running in SIMULATION mode');
        
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://visitrak-system.vercel.app';
        const resetLink = `${appUrl}/reset-password?email=${encodeURIComponent(normalizedEmail)}&simulation=true`;
        
        // Check if we should simulate SendGrid email
        const shouldSendEmail = process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL;
        
        if (shouldSendEmail) {
          try {
            console.log('📤 Simulating SendGrid email send...');
            
            const msg = {
              to: normalizedEmail,
              from: process.env.SENDGRID_FROM_EMAIL,
              subject: '[TEST] Reset Your VisiTrak Password',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                  <div style="background: linear-gradient(135deg, #5B3886, #8B5AA8); padding: 25px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">VisiTrak Password Reset</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Test Mode</p>
                  </div>
                  <div style="padding: 30px; background: #f9f9f9;">
                    <p><strong>Hello,</strong></p>
                    <p>This is a <strong>TEST EMAIL</strong> from the password reset system.</p>
                    <p>In production mode, this would contain a secure reset link.</p>
                    
                    <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
                      <p style="margin: 0; color: #856404; font-size: 14px;">
                        <strong>Note:</strong> Firebase Admin SDK not installed.<br>
                        Install with: <code>npm install firebase-admin</code>
                      </p>
                    </div>
                    
                    <p>Test reset link (not functional):</p>
                    <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; padding: 12px; margin: 15px 0;">
                      <code style="word-break: break-all; font-size: 12px;">${resetLink}</code>
                    </div>
                    
                    <p>For actual password reset, please contact your administrator.</p>
                  </div>
                  <div style="background: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #666;">
                    <p style="margin: 0;">© 2025 VisiTrak System | This is a test email</p>
                  </div>
                </div>
              `,
              text: `TEST EMAIL - VisiTrak Password Reset\n\nThis is a test email.\n\nReset link (test): ${resetLink}\n\nNote: Firebase Admin SDK not installed.`
            };
            
            await sgMail.send(msg);
            console.log('✅ Test email sent successfully');
            
          } catch (emailError) {
            console.error('❌ Failed to send test email:', emailError.message);
          }
        }
        
        return res.status(200).json({
          success: true,
          message: 'Password reset simulation completed',
          mode: 'simulation',
          email: normalizedEmail,
          sentTestEmail: shouldSendEmail,
          instructions: 'Install firebase-admin for full functionality',
          command: 'npm install firebase-admin',
          timestamp: new Date().toISOString()
        });
      }
      
      // ========== MODE 2: Production (firebase-admin is installed) ==========
      console.log('🚀 Running in PRODUCTION mode');
      
      // Wait for Firebase to initialize if needed
      if (!db) {
        const initialized = await initializeFirebaseAdmin();
        if (!initialized) {
          throw new Error('Firebase Admin initialization failed');
        }
      }
      
      // 1. Check if email exists in Firestore
      console.log(`🔍 Checking Firestore for email: ${normalizedEmail}`);
      const officesRef = db.collection('offices');
      const snapshot = await officesRef.where('email', '==', normalizedEmail).get();
      
      if (snapshot.empty) {
        console.log(`❌ Email not found: ${normalizedEmail}`);
        return res.status(404).json({
          success: false,
          message: 'This email address is not registered in the VisiTrak system',
          error: 'EMAIL_NOT_FOUND',
          email: normalizedEmail
        });
      }
      
      console.log(`✅ Email found in Firestore`);
      
      // 2. Generate secure reset token
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      
      // 3. Save token to Firestore
      console.log(`💾 Saving reset token for: ${normalizedEmail}`);
      await db.collection('passwordResetTokens').add({
        email: normalizedEmail,
        token: token,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        used: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
      });
      
      // 4. Create reset link
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://visitrak-system.vercel.app';
      const resetLink = `${appUrl}/reset-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;
      console.log(`🔗 Reset link generated`);
      
      // 5. Send email via SendGrid
      if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
        console.warn('⚠️ SendGrid not fully configured');
        return res.status(200).json({
          success: true,
          message: 'Reset token generated but email not sent',
          mode: 'token_only',
          email: normalizedEmail,
          resetLink: resetLink,
          token: token,
          expiresAt: expiresAt.toISOString(),
          note: 'Configure SENDGRID_API_KEY and SENDGRID_FROM_EMAIL to send emails',
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`📤 Sending password reset email to: ${normalizedEmail}`);
      
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
            <title>Reset Your Password</title>
            <style>
              @media only screen and (max-width: 600px) {
                .container { width: 100% !important; }
                .button { display: block !important; width: 100% !important; }
              }
            </style>
          </head>
          <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white;">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #5B3886, #8B5AA8); padding: 40px 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Reset Your Password</h1>
                <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">VisiTrak System</p>
              </div>
              
              <!-- Content -->
              <div style="padding: 40px 30px;">
                <p style="margin: 0 0 20px 0;">Hello,</p>
                
                <p style="margin: 0 0 25px 0;">We received a request to reset your password for your VisiTrak account. Click the button below to set a new password:</p>
                
                <!-- Reset Button -->
                <div style="text-align: center; margin: 35px 0;">
                  <a href="${resetLink}" 
                     style="background: #5B3886; color: white; padding: 16px 32px; 
                            text-decoration: none; border-radius: 8px; font-weight: 600;
                            font-size: 16px; display: inline-block; 
                            box-shadow: 0 4px 12px rgba(91, 56, 134, 0.3);">
                    Reset Password
                  </a>
                </div>
                
                <!-- Expiry Notice -->
                <div style="background: #fff8e1; border-left: 4px solid #ffb300; padding: 15px; margin: 25px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #856404; font-size: 14px;">
                    <strong>Important:</strong> This link will expire in <strong>15 minutes</strong>.
                  </p>
                </div>
                
                <!-- Alternative -->
                <p style="margin: 25px 0 15px 0; color: #666; font-size: 14px;">
                  If the button doesn't work, copy and paste this link into your browser:
                </p>
                <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin: 15px 0;">
                  <p style="margin: 0; word-break: break-all; font-family: 'Courier New', monospace; font-size: 13px; color: #495057;">
                    ${resetLink}
                  </p>
                </div>
                
                <!-- Security Notice -->
                <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px;">
                  <p style="margin: 0 0 10px 0; font-size: 13px; color: #6c757d;">
                    If you didn't request this password reset, please ignore this email or contact support if you have concerns.
                  </p>
                  <p style="margin: 0; font-size: 13px; color: #6c757d;">
                    For security reasons, this email was sent to ${normalizedEmail}.
                  </p>
                </div>
              </div>
              
              <!-- Footer -->
              <div style="background: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e9ecef;">
                <p style="margin: 0 0 10px 0; font-size: 12px; color: #6c757d;">
                  VisiTrak System | BISU - MASID
                </p>
                <p style="margin: 0; font-size: 11px; color: #adb5bd;">
                  © 2025 LMT. All rights reserved.
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Reset Your VisiTrak Password\n\nHello,\n\nClick this link to reset your password:\n${resetLink}\n\nThis link expires in 15 minutes.\n\nIf you didn't request this, please ignore this email.\n\nVisiTrak System | BISU - MASID`
      };
      
      await sgMail.send(msg);
      console.log('✅ Password reset email sent successfully');
      
      // 6. Return success response
      return res.status(200).json({
        success: true,
        message: 'Password reset email sent successfully',
        mode: 'production',
        email: normalizedEmail,
        expiresAt: expiresAt.toISOString(),
        note: 'Check your inbox (and spam folder) for the reset link',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error in password reset process:', error);
      console.error('Stack trace:', error.stack);
      
      // More specific error handling
      let statusCode = 500;
      let errorMessage = 'An unexpected error occurred';
      let errorCode = 'INTERNAL_ERROR';
      
      if (error.message.includes('Firebase Admin initialization')) {
        errorMessage = 'Authentication service unavailable';
        errorCode = 'FIREBASE_INIT_ERROR';
      } else if (error.message.includes('Firestore')) {
        errorMessage = 'Database error occurred';
        errorCode = 'FIRESTORE_ERROR';
      } else if (error.message.includes('SendGrid')) {
        errorMessage = 'Email service error';
        errorCode = 'EMAIL_SERVICE_ERROR';
        statusCode = 502;
      } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Network connectivity issue';
        errorCode = 'NETWORK_ERROR';
      }
      
      return res.status(statusCode).json({
        success: false,
        message: errorMessage,
        error: errorCode,
        details: process.env.NODE_ENV === 'production' ? undefined : error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // ========== Method Not Allowed ==========
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`,
    allowed: ['GET', 'POST', 'OPTIONS'],
    timestamp: new Date().toISOString()
  });
}