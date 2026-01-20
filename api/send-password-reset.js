// /api/send-password-reset.js
import sgMail from '@sendgrid/mail';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

// Your Firebase configuration (use same as frontend)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Configure SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid configured');
}

export default async function handler(req, res) {
  console.log(`📨 ${req.method} ${req.url}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // GET request for testing
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'Password Reset API',
      status: 'running',
      firebase: {
        projectId: firebaseConfig.projectId || 'not-set',
        apiKey: firebaseConfig.apiKey ? 'configured' : 'missing'
      },
      sendGrid: !!process.env.SENDGRID_API_KEY,
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
      
      // 1. Check if email exists in Firestore
      console.log('🔍 Checking Firestore...');
      const officesRef = collection(db, 'offices');
      const q = query(officesRef, where('email', '==', normalizedEmail));
      const snapshot = await getDocs(q);
      
      console.log(`📊 Found ${snapshot.size} matching documents`);
      
      if (snapshot.empty) {
        return res.status(404).json({
          success: false,
          message: 'Email not found in system',
          email: normalizedEmail
        });
      }
      
      // 2. Generate token
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      
      // 3. Save token to Firestore
      console.log('💾 Saving token...');
      const tokensRef = collection(db, 'passwordResetTokens');
      await addDoc(tokensRef, {
        email: normalizedEmail,
        token,
        expiresAt: Timestamp.fromDate(expiresAt),
        used: false,
        createdAt: serverTimestamp(),
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
      });
      
      // 4. Create reset link
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://visitrak-system.vercel.app';
      const resetLink = `${appUrl}/reset-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;
      
      // 5. Send email if SendGrid is configured
      if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
        console.log('📤 Sending email via SendGrid...');
        
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
                <p>This link expires in 15 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
              </div>
            </div>
          `,
          text: `Reset your VisiTrak password: ${resetLink}\n\nThis link expires in 15 minutes.`
        };
        
        await sgMail.send(msg);
        console.log('✅ Email sent successfully');
        
        return res.status(200).json({
          success: true,
          message: 'Password reset email sent successfully',
          email: normalizedEmail
        });
        
      } else {
        console.log('⚠️ SendGrid not configured, returning token only');
        
        return res.status(200).json({
          success: true,
          message: 'Password reset token generated',
          mode: 'token_only',
          email: normalizedEmail,
          resetLink: resetLink,
          note: 'Configure SendGrid to send emails automatically'
        });
      }
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      console.error('❌ Stack:', error.stack);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to process password reset',
        error: error.message,
        code: error.code
      });
    }
  }
  
  // Method not allowed
  return res.status(405).json({
    success: false,
    message: 'Method not allowed'
  });
}