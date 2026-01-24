import sgMail from '@sendgrid/mail';

// Configure SendGrid at module level
const SENDGRID_CONFIGURED = !!process.env.SENDGRID_API_KEY && !!process.env.SENDGRID_FROM_EMAIL;

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid API key configured');
}

// In-memory token store (fallback when Firestore quota is exceeded)
const MEMORY_TOKEN_STORE = new Map();

// Rate limiting
let lastResetTime = 0;
const RESET_COOLDOWN = 1000; // 1 second between resets globally
const userResetTimes = new Map();
const USER_RESET_COOLDOWN = 60 * 1000; // 1 minute per user

// Clean up old memory tokens periodically
setInterval(() => {
  const now = new Date();
  let cleanedCount = 0;
  
  for (const [token, data] of MEMORY_TOKEN_STORE.entries()) {
    if (data.expiresAt && new Date(data.expiresAt) < now) {
      MEMORY_TOKEN_STORE.delete(token);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned ${cleanedCount} expired tokens from memory store`);
  }
}, 5 * 60 * 1000); // Every 5 minutes

// Dynamic import for info.services - will only be used if needed
let addTokenToMemoryStore = null;

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
                                process.env.FIREBASE_PRIVATE_KEY),
        nodeEnv: process.env.NODE_ENV || 'development'
      },
      memoryStore: {
        tokenCount: MEMORY_TOKEN_STORE.size,
        users: Array.from(MEMORY_TOKEN_STORE.values()).map(t => t.email).filter((v, i, a) => a.indexOf(v) === i)
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
  
  // ========== RATE LIMITING ==========
  const now = Date.now();
  
  // Global rate limiting
  if (now - lastResetTime < RESET_COOLDOWN) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please wait a moment.',
      retryAfter: Math.ceil((RESET_COOLDOWN - (now - lastResetTime)) / 1000)
    });
  }
  lastResetTime = now;
  
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
    
    // User-specific rate limiting
    if (userResetTimes.has(normalizedEmail)) {
      const lastUserReset = userResetTimes.get(normalizedEmail);
      if (now - lastUserReset < USER_RESET_COOLDOWN) {
        const waitSeconds = Math.ceil((USER_RESET_COOLDOWN - (now - lastUserReset)) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${waitSeconds} second${waitSeconds !== 1 ? 's' : ''} before requesting another reset.`,
          email: normalizedEmail,
          retryAfter: waitSeconds
        });
      }
    }
    userResetTimes.set(normalizedEmail, now);
    
    console.log(`\n📧 Password reset request for: ${normalizedEmail}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Check Firebase Admin availability
    const hasFirebaseAdmin = !!(
      process.env.FIREBASE_PRIVATE_KEY && 
      process.env.FIREBASE_CLIENT_EMAIL && 
      process.env.FIREBASE_PROJECT_ID
    );
    
    console.log('🔧 Firebase Admin available:', hasFirebaseAdmin);
    
    let officeData = null;
    let token = null;
    let expiresAt = null;
    let tokenSaved = false;
    let officeId = null;
    let officeName = null;
    let officialName = null;
    let tokenId = null;
    let usingMemoryStore = false;
    let firestoreError = null;
    
    // ========== TRY FIRESTORE FIRST ==========
    if (hasFirebaseAdmin) {
      try {
        console.log('\n🔥 Attempting Firebase Admin initialization...');
        const { default: admin } = await import('firebase-admin');
        
        // Initialize Firebase Admin if needed
        if (!admin.apps.length) {
          let privateKey = process.env.FIREBASE_PRIVATE_KEY;
          
          // Handle escaped newlines in private key
          if (privateKey && privateKey.includes('\\n')) {
            console.log('   🔄 Replacing escaped newlines in private key');
            privateKey = privateKey.replace(/\\n/g, '\n');
          }
          
          // Validate private key
          if (!privateKey || privateKey.trim() === '' || !privateKey.includes('BEGIN PRIVATE KEY')) {
            console.error('❌ Invalid FIREBASE_PRIVATE_KEY format');
            throw new Error('Invalid Firebase private key format');
          }
          
          console.log('   📝 Initializing Firebase app...');
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: privateKey,
            }),
          });
          console.log('✅ Firebase Admin initialized successfully');
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
        
        // Generate secure reset token
        const crypto = await import('crypto');
        token = crypto.randomBytes(32).toString('hex');
        
        expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        
        console.log('🔐 Generated reset token:', token.substring(0, 20) + '...');
        console.log('⏳ Token expires at:', expiresAt.toISOString());
        
        // Save token to Firestore
        console.log('💾 Saving token to Firestore...');
        const tokenData = {
          email: normalizedEmail,
          token: token,
          officeId: officeId,
          officeName: officeName,
          officialName: officialName,
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          used: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          requestTime: new Date().toISOString(),
          ipAddress: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown'
        };
        
        try {
          // Try to save to Firestore
          const tokenRef = await db.collection('passwordResetTokens').add(tokenData);
          tokenId = tokenRef.id;
          
          // Verify save
          const savedTokenDoc = await tokenRef.get();
          if (savedTokenDoc.exists) {
            const savedData = savedTokenDoc.data();
            console.log('✅ Token saved to Firestore:', {
              tokenId,
              email: savedData.email,
              tokenPreview: savedData.token?.substring(0, 20) + '...',
              expiresAt: savedData.expiresAt?.toDate()?.toISOString()
            });
            tokenSaved = true;
            
            // Also store in memory as backup
            MEMORY_TOKEN_STORE.set(token, {
              id: tokenId,
              ...tokenData,
              storedIn: 'both',
              firestoreId: tokenId
            });
            console.log('   📦 Also stored in memory as backup');
            
          } else {
            console.error('❌ Token document not found after save');
            throw new Error('Token not saved to Firestore');
          }
          
        } catch (firestoreError) {
          console.error('❌ Firestore save error:', firestoreError.message);
          console.error('   Code:', firestoreError.code);
          console.error('   Details:', firestoreError.details);
          
          // Check if it's a quota error
          if (firestoreError.code === 'resource-exhausted' || 
              firestoreError.message.includes('quota') ||
              firestoreError.message.includes('exceeded')) {
            console.log('⚠️ FIRESTORE QUOTA EXCEEDED - Switching to memory store');
            firestoreError = 'QUOTA_EXCEEDED';
            usingMemoryStore = true;
          } else if (firestoreError.code === 'permission-denied') {
            console.log('⚠️ Firestore permission denied');
            firestoreError = 'PERMISSION_DENIED';
            usingMemoryStore = true;
          } else {
            // Re-throw other errors
            throw firestoreError;
          }
        }
        
      } catch (firebaseError) {
        console.error('❌ Firebase error:', firebaseError.message);
        console.log('🔄 Falling back to memory token store...');
        firestoreError = firebaseError.message;
        usingMemoryStore = true;
      }
    } else {
      console.log('⚠️ Firebase Admin not configured, using memory store');
      usingMemoryStore = true;
    }
    
    // ========== FALLBACK: MEMORY TOKEN STORE ==========
    if (usingMemoryStore || !tokenSaved) {
      console.log('\n💾 Using in-memory token store');
      
      // Generate token if not already generated
      if (!token) {
        const crypto = await import('crypto');
        token = crypto.randomBytes(32).toString('hex');
        expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      }
      
      tokenId = `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // If we don't have office data from Firestore, use defaults
      if (!officeName) {
        officeName = 'Office';
        officialName = '';
      }
      
      // Store in memory
      MEMORY_TOKEN_STORE.set(token, {
        id: tokenId,
        email: normalizedEmail,
        token: token,
        officeId: officeId,
        officeName: officeName,
        officialName: officialName,
        expiresAt: expiresAt,
        used: false,
        createdAt: new Date().toISOString(),
        storedIn: 'memory',
        firestoreError: firestoreError
      });
      
      tokenSaved = true;
      usingMemoryStore = true;
      
      console.log('✅ Token stored in memory:', {
        tokenId,
        email: normalizedEmail,
        tokenPreview: token.substring(0, 20) + '...',
        expiresAt: expiresAt.toISOString(),
        memoryStoreSize: MEMORY_TOKEN_STORE.size
      });
      
      // ========== IMPORTANT: REGISTER WITH INFO.SERVICES.JS MEMORY STORE ==========
      try {
        // Dynamically import info.services module
        if (!addTokenToMemoryStore) {
          const infoServices = await import('../lib/info.services.js');
          addTokenToMemoryStore = infoServices.addTokenToMemoryStore;
        }
        
        if (addTokenToMemoryStore) {
          // Register the token with info.services.js memory store
          const infoServicesTokenId = addTokenToMemoryStore({
            token: token,
            email: normalizedEmail,
            officeId: officeId,
            officeName: officeName,
            officialName: officialName,
            expiresAt: expiresAt
          });
          
          if (infoServicesTokenId) {
            console.log("✅ Token registered with info.services memory store:", infoServicesTokenId);
            
            // Update tokenId to use the one from info.services for consistency
            tokenId = infoServicesTokenId;
            
            // Update our local memory store entry with the correct ID
            const updatedEntry = MEMORY_TOKEN_STORE.get(token);
            if (updatedEntry) {
              updatedEntry.id = tokenId;
              MEMORY_TOKEN_STORE.set(token, updatedEntry);
            }
          }
        } else {
          console.log("⚠️ addTokenToMemoryStore function not available in info.services");
        }
      } catch (infoServicesError) {
        console.error("❌ Error registering token with info.services:", infoServicesError.message);
        console.log("ℹ️ Token is still stored in local memory store, but validation might fail");
      }
    }
    
    // Generate reset link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   process.env.VERCEL_URL || 
                   (req.headers['x-forwarded-host'] ? `https://${req.headers['x-forwarded-host']}` : 'https://visitrak-system.vercel.app');
    
    const resetLink = `${appUrl}/reset-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;
    
    console.log('\n🔗 Reset link generated:', {
      tokenPreview: token.substring(0, 20) + '...',
      email: normalizedEmail,
      resetLink: resetLink.substring(0, 100) + (resetLink.length > 100 ? '...' : ''),
      storage: usingMemoryStore ? 'memory' : 'firestore',
      firestoreError: firestoreError,
      tokenId: tokenId
    });
    
    // ========== CHECK SENDGRID CONFIGURATION ==========
    if (!SENDGRID_CONFIGURED) {
      console.warn('⚠️ SendGrid not fully configured');
      
      return res.status(200).json({
        success: true,
        message: 'Password reset token generated (development mode)',
        mode: 'development',
        storage: usingMemoryStore ? 'memory' : 'firestore',
        email: normalizedEmail,
        office: officeName,
        officialName: officialName,
        resetLink: resetLink, // Full link for testing
        token: token, // Include full token for testing
        tokenId: tokenId,
        expiresAt: expiresAt.toISOString(),
        tokenSaved: tokenSaved,
        memoryStoreSize: MEMORY_TOKEN_STORE.size,
        warning: 'Email not sent - configure SENDGRID_API_KEY and SENDGRID_FROM_EMAIL',
        instructions: 'Click the resetLink above or copy it to test password reset',
        firestoreStatus: firestoreError ? 'failed' : 'success',
        firestoreError: firestoreError,
        nextSteps: [
          'Add SENDGRID_API_KEY to Vercel environment variables',
          'Add SENDGRID_FROM_EMAIL to Vercel environment variables',
          'Check Firebase quota in console.firebase.google.com',
          'Redeploy the application'
        ]
      });
    }
    
    // ========== SEND EMAIL VIA SENDGRID ==========
    console.log('\n📤 Preparing to send email via SendGrid...');
    
    const emailMessage = {
      to: normalizedEmail,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: 'VisiTrak System'
      },
      subject: 'Reset Your VisiTrak Password',
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset - VisiTrak</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }
        
        body {
            background-color: #f7f7f7;
            color: #333;
            line-height: 1.6;
            padding: 20px;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
        
        .header {
            background: linear-gradient(135deg, #5B3886, #8B5AA8);
            padding: 30px 20px;
            text-align: center;
        }
        
        .logo {
            width: 80px;
            height: auto;
            margin-bottom: 15px;
        }
        
        .logo-text {
            font-size: 32px;
            font-weight: 700;
            color: white;
            letter-spacing: -0.5px;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .greeting {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 20px;
            color: #222;
        }
        
        .user-name {
            color: #5B3886;
            font-weight: 700;
        }
        
        .message {
            font-size: 16px;
            color: #555;
            margin-bottom: 25px;
        }
        
        .highlight-box {
            background-color: #f8f9fa;
            border-left: 4px solid #5B3886;
            padding: 15px 20px;
            margin: 25px 0;
            border-radius: 0 8px 8px 0;
        }
        
        .highlight-text {
            font-size: 14px;
            color: #666;
        }
        
        .login-button {
            display: block;
            width: 100%;
            background: linear-gradient(135deg, #5B3886, #8B5AA8);
            color: white;
            text-align: center;
            padding: 18px;
            text-decoration: none;
            font-weight: 700;
            font-size: 18px;
            border-radius: 50px;
            margin: 30px 0;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(91, 56, 134, 0.2);
        }
        
        .link-note {
            font-size: 14px;
            color: #888;
            text-align: center;
            margin-bottom: 30px;
        }
        
        .warning-box {
            background-color: #fff8e6;
            border: 1px solid #ffd54f;
            border-radius: 8px;
            padding: 20px;
            margin-top: 30px;
        }
        
        .warning-title {
            color: #ff9800;
            font-weight: 600;
            margin-bottom: 8px;
            font-size: 16px;
        }
        
        .warning-text {
            font-size: 14px;
            color: #666;
        }
        
        .footer {
            background-color: #f8f9fa;
            padding: 25px 30px;
            text-align: center;
            border-top: 1px solid #eee;
        }
        
        .footer-text {
            font-size: 14px;
            color: #888;
            margin-bottom: 10px;
        }
        
        .brand-name {
            font-weight: 600;
            color: #5B3886;
        }
        
        .token-info {
            font-size: 12px;
            color: #999;
            text-align: center;
            margin-top: 15px;
            background-color: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            word-break: break-all;
            font-family: monospace;
        }
        
        @media (max-width: 480px) {
            .content {
                padding: 30px 20px;
            }
            
            .greeting {
                font-size: 22px;
            }
            
            .login-button {
                padding: 16px;
                font-size: 16px;
            }
            
            .header {
                padding: 25px 15px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <!-- VisiTrak Logo -->
            <div class="logo">
                <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style="width: 80px; height: 80px;">
                    <circle cx="60" cy="60" r="56" fill="#5B3886"/>
                    <path fill="white" d="M60 30c-16.54 0-30 13.46-30 30s13.46 30 30 30 30-13.46 30-30-13.46-30-30-30zm0 10c11.05 0 20 8.95 20 20s-8.95 20-20 20-20-8.95-20-20 8.95-20 20-20z"/>
                    <path fill="white" d="M60 45c-8.28 0-15 6.72-15 15s6.72 15 15 15 15-6.72 15-15-6.72-15-15-15zm0 5c5.52 0 10 4.48 10 10s-4.48 10-10 10-10-4.48-10-10 4.48-10 10-10z"/>
                    <circle cx="60" cy="60" r="8" fill="#8B5AA8"/>
                </svg>
            </div>
            <div class="logo-text">VisiTrak</div>
        </div>
        
        <div class="content">
            <h1 class="greeting">Hi <span class="user-name">${officeName || normalizedEmail.split('@')[0]}</span>,</h1>
            
            <p class="message">
                You recently requested to reset your password for your VisiTrak account. To complete the reset process, click the button below. This link is valid for 15 minutes.
            </p>
            
            <div class="highlight-box">
                <p class="highlight-text">
                    <strong>Important:</strong> For your security, this link will expire in 15 minutes. If you don't use it within that time, you'll need to request a new reset link.
                </p>
            </div>
            
            <a href="${resetLink}" class="login-button">
                🔑 RESET YOUR PASSWORD
            </a>
            
            <p class="link-note">
                This link confirms your email address associated with your VisiTrak account.
            </p>
            
            <div class="warning-box">
                <div class="warning-title">Not you?</div>
                <p class="warning-text">
                    If you didn't request a password reset, don't worry. Your email address may have been entered by mistake. You can safely ignore or delete this email, and continue using your existing password to log in.
                </p>
            </div>
            
            <div class="token-info">
                ${process.env.NODE_ENV === 'development' ? resetLink : 'Reset link valid for 15 minutes'}
            </div>
        </div>
        
        <div class="footer">
            <p class="footer-text">Thank you for using VisiTrak,</p>
            <p class="footer-text"><span class="brand-name">The VisiTrak Team</span></p>
            <p class="footer-text" style="margin-top: 15px; font-size: 12px;">
                This is an automated message, please do not reply to this email.
            </p>
            <p class="footer-text" style="font-size: 11px; color: #aaa; margin-top: 10px;">
                © ${new Date().getFullYear()} VisiTrak System - BISU MASID
            </p>
        </div>
    </div>
</body>
</html>
      `,
      text: `
VisiTrak Password Reset

Hello ${officeName || normalizedEmail.split('@')[0]},

You recently requested to reset your password for your VisiTrak account.

Reset your password by clicking this link:
${resetLink}

IMPORTANT:
• This link will expire in 15 minutes
• If you didn't request this, please ignore this email
• For security, this link can only be used once

---
© ${new Date().getFullYear()} VisiTrak System - BISU MASID
This is an automated message, please do not reply.
      `.trim()
    };
    
    try {
      console.log('📮 Sending email via SendGrid...');
      const sendGridResponse = await sgMail.send(emailMessage);
      
      const statusCode = sendGridResponse[0]?.statusCode;
      const messageId = sendGridResponse[0]?.headers?.['x-message-id'];
      
      console.log('✅ SendGrid Response:', { statusCode, messageId });
      
      if (statusCode === 202) {
        console.log('✅ Email accepted for delivery by SendGrid');
        
        return res.status(200).json({
          success: true,
          message: 'Password reset email sent successfully',
          storage: usingMemoryStore ? 'memory' : 'firestore',
          firestoreStatus: firestoreError ? 'failed_fallback' : 'success',
          email: normalizedEmail,
          office: officeName,
          officialName: officialName,
          expiresAt: expiresAt.toISOString(),
          messageId: messageId,
          tokenSaved: tokenSaved,
          tokenId: tokenId,
          memoryStoreSize: MEMORY_TOKEN_STORE.size,
          note: 'Please check your inbox and spam folder for the reset link'
        });
      } else {
        console.warn(`⚠️ Unexpected status code from SendGrid: ${statusCode}`);
        
        // Even if SendGrid fails, return token for manual testing
        return res.status(200).json({
          success: true,
          message: 'Password reset token generated but email sending had issues',
          storage: usingMemoryStore ? 'memory' : 'firestore',
          email: normalizedEmail,
          office: officeName,
          officialName: officialName,
          resetLink: resetLink,
          token: token,
          tokenId: tokenId,
          expiresAt: expiresAt.toISOString(),
          tokenSaved: tokenSaved,
          sendGridStatus: statusCode,
          memoryStoreSize: MEMORY_TOKEN_STORE.size,
          warning: 'Email sending had issues, but token was generated',
          instructions: 'Use the resetLink above to manually test password reset'
        });
      }
      
    } catch (sendGridError) {
      console.error('❌ SendGrid Error:', sendGridError.message);
      
      // Even if SendGrid completely fails, return the token for manual testing
      return res.status(200).json({
        success: true,
        message: 'Password reset token generated but email sending failed',
        storage: usingMemoryStore ? 'memory' : 'firestore',
        firestoreStatus: firestoreError ? 'failed_fallback' : 'success',
        email: normalizedEmail,
        office: officeName,
        officialName: officialName,
        resetLink: resetLink,
        token: token,
        tokenId: tokenId,
        expiresAt: expiresAt.toISOString(),
        tokenSaved: tokenSaved,
        memoryStoreSize: MEMORY_TOKEN_STORE.size,
        warning: 'Email sending failed, but token was generated',
        sendGridError: sendGridError.message,
        instructions: 'Use the resetLink above to manually test password reset',
        troubleshooting: [
          'Check SendGrid API key configuration',
          'Verify sender email is verified in SendGrid',
          'Test with the resetLink provided above'
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
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString(),
      memoryStoreSize: MEMORY_TOKEN_STORE.size
    });
  }
}