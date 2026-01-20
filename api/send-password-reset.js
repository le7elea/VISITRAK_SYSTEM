import sgMail from '@sendgrid/mail';

let admin;
let db;
let hasFirebaseAdmin = false;

async function initializeFirebaseAdmin() {
  try {
    console.log('🔄 Initializing Firebase Admin...');
    
    // Check if environment variables are set
    if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PROJECT_ID) {
      console.error('❌ Missing Firebase environment variables');
      return false;
    }
    
    const firebaseAdminModule = await import('firebase-admin');
    admin = firebaseAdminModule.default;
    hasFirebaseAdmin = true;
    
    if (!admin.apps.length) {
      console.log('📋 Firebase config:', {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKeyLength: process.env.FIREBASE_PRIVATE_KEY?.length || 0,
        privateKeyStartsWith: process.env.FIREBASE_PRIVATE_KEY?.substring(0, 50) + '...'
      });
      
      // Format private key properly
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      // Replace escaped newlines with actual newlines
      if (privateKey.includes('\\n')) {
        console.log('🔧 Replacing escaped newlines in private key');
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      
      // Ensure proper PEM format
      if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        console.error('❌ Private key missing BEGIN marker');
        return false;
      }
      
      if (!privateKey.includes('-----END PRIVATE KEY-----')) {
        console.error('❌ Private key missing END marker');
        return false;
      }
      
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
          }),
        });
        
        console.log('✅ Firebase Admin initialized successfully');
        
        // Test the connection
        db = admin.firestore();
        const testDoc = await db.collection('test').doc('connection-test').get();
        console.log('✅ Firebase Firestore connection test passed');
        
        return true;
        
      } catch (initError) {
        console.error('❌ Firebase initialization error:', initError.message);
        console.error('❌ Error details:', {
          code: initError.code,
          details: initError.details
        });
        return false;
      }
    }
    
    db = admin.firestore();
    return true;
    
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
    console.error('❌ Stack trace:', error.stack);
    return false;
  }
}

// Initialize Firebase
initializeFirebaseAdmin().then(success => {
  if (success) {
    console.log('🚀 Firebase Admin ready for production');
  } else {
    console.log('⚠️ Firebase Admin not available, running in limited mode');
  }
});

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
      status: hasFirebaseAdmin ? 'production_ready' : 'simulation_mode',
      firebase: {
        hasFirebaseAdmin: hasFirebaseAdmin,
        projectId: process.env.FIREBASE_PROJECT_ID ? 'configured' : 'missing',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL ? 'configured' : 'missing',
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? 'configured' : 'missing'
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
      
      // If Firebase is not available, use simulation mode
      if (!hasFirebaseAdmin) {
        console.log('🎭 Using simulation mode');
        
        // Try to initialize Firebase one more time
        const initialized = await initializeFirebaseAdmin();
        if (!initialized) {
          return res.status(200).json({
            success: true,
            message: 'Password reset simulation',
            mode: 'simulation',
            email: normalizedEmail,
            instructions: 'Check Firebase Admin configuration in Vercel environment variables',
            error: 'UNAUTHENTICATED - Invalid Firebase credentials'
          });
        }
      }
      
      // Now try to use Firebase
      try {
        // Ensure db is initialized
        if (!db && admin) {
          db = admin.firestore();
        }
        
        if (!db) {
          throw new Error('Firestore not initialized');
        }
        
        // Check if email exists
        console.log('🔍 Checking Firestore...');
        const snapshot = await db.collection('offices')
          .where('email', '==', normalizedEmail)
          .limit(1)
          .get();
        
        console.log(`📊 Found ${snapshot.size} matching documents`);
        
        if (snapshot.empty) {
          return res.status(404).json({
            success: false,
            message: 'Email not found in system',
            email: normalizedEmail
          });
        }
        
        // Generate token
        const crypto = await import('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        
        // Save token
        console.log('💾 Saving token...');
        await db.collection('passwordResetTokens').add({
          email: normalizedEmail,
          token,
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          used: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Create reset link
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://visitrak-system.vercel.app';
        const resetLink = `${appUrl}/reset-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;
        
        // Send email if SendGrid is configured
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
            `
          };
          
          await sgMail.send(msg);
          console.log('✅ Email sent successfully');
          
          return res.status(200).json({
            success: true,
            message: 'Password reset email sent successfully',
            mode: 'production',
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
        
      } catch (firebaseError) {
        console.error('❌ Firebase error:', firebaseError.message);
        console.error('❌ Error code:', firebaseError.code);
        
        // Handle authentication errors
        if (firebaseError.code === 16 || firebaseError.message.includes('UNAUTHENTICATED')) {
          return res.status(401).json({
            success: false,
            message: 'Authentication failed',
            mode: 'error',
            error: 'Firebase authentication invalid',
            instructions: 'Please check Firebase service account credentials in Vercel environment variables',
            fix: 'Generate new private key in Firebase Console → Project Settings → Service Accounts'
          });
        }
        
        throw firebaseError;
      }
      
    } catch (error) {
      console.error('❌ General error:', error.message);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to process password reset',
        mode: 'error',
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