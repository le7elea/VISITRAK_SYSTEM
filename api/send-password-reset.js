// /api/send-password-reset.js
import sgMail from '@sendgrid/mail';

// Configure SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid configured');
} else {
  console.warn('⚠️ SENDGRID_API_KEY not set');
}

export default async function handler(req, res) {
  console.log(`📨 ${req.method} ${req.url}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // GET request for testing
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'Password Reset API',
      status: 'running',
      sendGrid: !!process.env.SENDGRID_API_KEY,
      hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
      timestamp: new Date().toISOString()
    });
  }
  
  // POST request - Process password reset
  if (req.method === 'POST') {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }
      
      const normalizedEmail = email.trim().toLowerCase();
      console.log(`📧 Processing: ${normalizedEmail}`);
      
      // Check if we have Firebase Admin credentials
      const hasFirebaseAdmin = process.env.FIREBASE_PRIVATE_KEY && 
                               process.env.FIREBASE_CLIENT_EMAIL && 
                               process.env.FIREBASE_PROJECT_ID;
      
      let officeData = null;
      let token = null;
      let expiresAt = null;
      
      if (hasFirebaseAdmin) {
        // Use Firebase Admin SDK
        try {
          console.log('🚀 Using Firebase Admin SDK...');
          const firebaseAdminModule = await import('firebase-admin');
          const admin = firebaseAdminModule.default;
          
          // Initialize Firebase Admin if not already initialized
          if (!admin.apps.length) {
            let privateKey = process.env.FIREBASE_PRIVATE_KEY;
            
            // Replace escaped newlines with actual newlines
            if (privateKey.includes('\\n')) {
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
          console.log('🔍 Checking Firestore offices collection...');
          const snapshot = await db.collection('offices')
            .where('email', '==', normalizedEmail)
            .limit(1)
            .get();
          
          console.log(`📊 Found ${snapshot.size} matching documents`);
          
          if (snapshot.empty) {
            return res.status(404).json({
              success: false,
              message: 'This email is not registered in the VisiTrak system.',
              email: normalizedEmail,
              error: 'EMAIL_NOT_FOUND'
            });
          }
          
          // Get office data
          const officeDoc = snapshot.docs[0];
          officeData = officeDoc.data();
          console.log('✅ Email found in offices collection:', {
            id: officeDoc.id,
            email: officeData.email,
            name: officeData.name || 'N/A',
            officialName: officeData.officialName || 'N/A'
          });
          
          // Generate reset token
          const crypto = await import('crypto');
          token = crypto.randomBytes(32).toString('hex');
          expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
          
          // Save token to Firestore
          console.log('💾 Saving reset token...');
          await db.collection('passwordResetTokens').add({
            email: normalizedEmail,
            token,
            officeId: officeDoc.id,
            officeName: officeData.name || 'Unknown Office',
            officialName: officeData.officialName || '',
            expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
            used: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            requestTime: new Date().toISOString()
          });
          
          console.log('✅ Token saved to Firestore');
          
        } catch (firebaseError) {
          console.error('❌ Firebase Admin error:', firebaseError.message);
          
          // If Firebase Admin fails, fall back to simple mode
          console.log('🔄 Falling back to simple mode...');
          officeData = {
            name: 'Office (Unknown)',
            email: normalizedEmail
          };
          
          const crypto = await import('crypto');
          token = crypto.randomBytes(32).toString('hex');
          expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        }
      } else {
        // Simple mode - no Firebase Admin, just generate token
        console.log('🎭 Using simple mode (no Firebase Admin)');
        officeData = {
          name: 'Office (Unknown)',
          email: normalizedEmail
        };
        
        const crypto = await import('crypto');
        token = crypto.randomBytes(32).toString('hex');
        expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      }
      
      // Create reset link
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://visitrak-system.vercel.app';
      const resetLink = `${appUrl}/reset-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;
      console.log('🔗 Reset link created');
      
      // Send email via SendGrid
      if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
        console.warn('⚠️ SendGrid not fully configured');
        
        // Return success with token (for development)
        return res.status(200).json({
          success: true,
          message: 'Password reset token generated successfully',
          mode: 'development',
          email: normalizedEmail,
          office: officeData.name || 'Unknown Office',
          officialName: officeData.officialName || '',
          resetLink: resetLink,
          token: token,
          expiresAt: expiresAt.toISOString(),
          note: 'Configure SENDGRID_API_KEY and SENDGRID_FROM_EMAIL to send emails automatically'
        });
      }
      
      console.log('📤 Sending email via SendGrid...');
      
      // Create email message
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
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #5B3886, #8B5AA8); padding: 30px; text-align: center; }
              .header h1 { color: white; margin: 0; font-size: 24px; }
              .content { padding: 30px; }
              .button { background: #5B3886; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px; }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
              .office-info { background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #5B3886; }
              .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0; color: #856404; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>VisiTrak Password Reset</h1>
              </div>
              <div class="content">
                <p><strong>Hello,</strong></p>
                <p>You recently requested to reset your password for your VisiTrak account.</p>
                
                <div class="office-info">
                  <p><strong>Account Details:</strong></p>
                  <p>Email: ${normalizedEmail}</p>
                  <p>Office: ${officeData.name || officeData.officeName || 'VisiTrak System'}</p>
                  ${officeData.officialName ? `<p>Official Name: ${officeData.officialName}</p>` : ''}
                </div>
                
                <p>Click the button below to reset your password:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetLink}" class="button">
                    Reset Password
                  </a>
                </div>
                
                <div class="warning">
                  <p><strong>Important:</strong> This password reset link will expire in <strong>15 minutes</strong>.</p>
                  <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
                </div>
                
                <div class="footer">
                  <p>If the button above doesn't work, copy and paste this URL into your browser:</p>
                  <p style="background: #f8f9fa; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 12px;">
                    ${resetLink}
                  </p>
                  <p style="margin-top: 20px;">This email was sent to ${normalizedEmail} for ${officeData.name || officeData.officeName || 'VisiTrak System'}.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `VisiTrak Password Reset\n\nHello,\n\nClick this link to reset your password:\n${resetLink}\n\nThis link expires in 15 minutes.\n\nAccount: ${normalizedEmail}\nOffice: ${officeData.name || officeData.officeName || 'VisiTrak System'}\n${officeData.officialName ? `Official Name: ${officeData.officialName}\n` : ''}\nIf you didn't request this, please ignore this email.`
      };
      
      // Send email
      await sgMail.send(msg);
      console.log('✅ Password reset email sent successfully');
      
      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Password reset email sent successfully',
        email: normalizedEmail,
        office: officeData.name || officeData.officeName || 'Unknown Office',
        officialName: officeData.officialName || '',
        expiresAt: expiresAt.toISOString(),
        note: 'Please check your inbox (and spam folder) for the reset link'
      });
      
    } catch (error) {
      console.error('❌ Error processing password reset:', error);
      console.error('Error stack:', error.stack);
      
      // Handle specific errors
      let statusCode = 500;
      let errorMessage = 'Failed to process password reset request';
      
      if (error.code === 16 || error.message.includes('UNAUTHENTICATED')) {
        statusCode = 401;
        errorMessage = 'Firebase authentication failed. Check service account credentials.';
      } else if (error.code === 'permission-denied') {
        statusCode = 403;
        errorMessage = 'Permission denied. Please check Firestore security rules.';
      } else if (error.message.includes('Firestore')) {
        errorMessage = 'Database connection error. Please try again.';
      } else if (error.message.includes('SendGrid') || error.message.includes('email')) {
        errorMessage = 'Email service error. Please try again later.';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      return res.status(statusCode).json({
        success: false,
        message: errorMessage,
        error: error.message,
        details: process.env.NODE_ENV === 'production' ? undefined : error.message
      });
    }
  }
  
  // Method not allowed
  return res.status(405).json({
    success: false,
    message: 'Method not allowed'
  });
}