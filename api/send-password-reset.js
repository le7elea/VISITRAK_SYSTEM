// /api/send-password-reset.js - USING FIREBASE AUTH
import sgMail from '@sendgrid/mail';

let admin;
let hasFirebaseAdmin = false;

async function initializeFirebaseAdmin() {
  try {
    // Check environment variables
    if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PROJECT_ID) {
      console.error('❌ Missing Firebase environment variables');
      return false;
    }
    
    const firebaseAdminModule = await import('firebase-admin');
    admin = firebaseAdminModule.default;
    hasFirebaseAdmin = true;
    
    if (!admin.apps.length) {
      // Format private key
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
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
      
      console.log('✅ Firebase Admin initialized for Auth');
      return true;
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
    return false;
  }
}

initializeFirebaseAdmin();

// Configure SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'Password Reset API',
      status: hasFirebaseAdmin ? 'ready' : 'needs_configuration',
      timestamp: new Date().toISOString()
    });
  }
  
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
      console.log(`Processing password reset for: ${normalizedEmail}`);
      
      // MODE 1: Use Firebase Auth if available
      if (hasFirebaseAdmin && admin) {
        try {
          // Check if user exists in Firebase Auth
          let userRecord;
          try {
            userRecord = await admin.auth().getUserByEmail(normalizedEmail);
            console.log(`✅ User found in Firebase Auth: ${userRecord.uid}`);
          } catch (authError) {
            // User not found in Firebase Auth
            console.log(`❌ User not in Firebase Auth: ${normalizedEmail}`);
            return res.status(404).json({
              success: false,
              message: 'Email not found in system',
              email: normalizedEmail
            });
          }
          
          // Generate password reset link
          const actionCodeSettings = {
            url: process.env.NEXT_PUBLIC_APP_URL || 'https://visitrak-system.vercel.app/reset-password',
            handleCodeInApp: false
          };
          
          const resetLink = await admin.auth().generatePasswordResetLink(normalizedEmail, actionCodeSettings);
          
          // Send email via SendGrid
          if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
            const msg = {
              to: normalizedEmail,
              from: process.env.SENDGRID_FROM_EMAIL,
              subject: 'Reset Your VisiTrak Password',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: #5B3886; padding: 30px; text-align: center; color: white;">
                    <h1 style="margin: 0;">VisiTrak Password Reset</h1>
                  </div>
                  <div style="padding: 30px; background: #f9f9f9;">
                    <p>Click the button below to reset your password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${resetLink}" 
                         style="background: #5B3886; color: white; padding: 14px 28px; 
                                text-decoration: none; border-radius: 8px; font-weight: bold;
                                display: inline-block;">
                        Reset Password
                      </a>
                    </div>
                    <p>This link expires in 1 hour.</p>
                  </div>
                </div>
              `
            };
            
            await sgMail.send(msg);
            console.log('✅ Password reset email sent');
            
            return res.status(200).json({
              success: true,
              message: 'Password reset email sent successfully',
              email: normalizedEmail
            });
            
          } else {
            // SendGrid not configured
            return res.status(200).json({
              success: true,
              message: 'Password reset link generated',
              mode: 'development',
              email: normalizedEmail,
              resetLink: resetLink,
              note: 'Configure SendGrid to send emails automatically'
            });
          }
          
        } catch (authError) {
          console.error('❌ Firebase Auth error:', authError.message);
          
          return res.status(500).json({
            success: false,
            message: 'Authentication service error',
            error: authError.message
          });
        }
      }
      
      // MODE 2: Fallback simulation
      console.log('🎭 Using simulation mode');
      
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://visitrak-system.vercel.app';
      const resetLink = `${appUrl}/reset-password?email=${encodeURIComponent(normalizedEmail)}&simulation=true`;
      
      return res.status(200).json({
        success: true,
        message: 'Password reset simulation',
        mode: 'simulation',
        email: normalizedEmail,
        resetLink: resetLink,
        instructions: 'Users must be registered in Firebase Authentication for production'
      });
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to process request',
        error: error.message
      });
    }
  }
  
  return res.status(405).json({ success: false, message: 'Method not allowed' });
}