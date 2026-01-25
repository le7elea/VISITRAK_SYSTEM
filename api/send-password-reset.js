import sgMail from '@sendgrid/mail';

// Configure SendGrid at module level
const SENDGRID_CONFIGURED = !!process.env.SENDGRID_API_KEY && !!process.env.SENDGRID_FROM_EMAIL;

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid API key configured');
}

// Rate limiting
let lastResetTime = 0;
const RESET_COOLDOWN = 1000; // 1 second between resets globally
const userResetTimes = new Map();
const USER_RESET_COOLDOWN = 60 * 1000; // 1 minute per user

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
    
    if (!hasFirebaseAdmin) {
      console.error('❌ Firebase Admin not configured');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error. Please contact administrator.',
        error: 'SERVER_CONFIG_ERROR',
        details: 'Firebase Admin SDK not properly configured'
      });
    }
    
    let officeData = null;
    let token = null;
    let expiresAt = null;
    let tokenSaved = false;
    let officeId = null;
    let officeName = null;
    let officialName = null;
    let tokenId = null;
    
    // ========== USE FIRESTORE ONLY ==========
    try {
      console.log('\n🔥 Initializing Firebase Admin...');
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
      } else {
        console.error('❌ Token document not found after save');
        throw new Error('Token not saved to Firestore');
      }
      
    } catch (firebaseError) {
      console.error('❌ Firebase error:', firebaseError.message);
      console.error('Stack:', firebaseError.stack);
      
      // Differentiate between different types of errors
      if (firebaseError.code === 'resource-exhausted' || 
          firebaseError.message.includes('quota') ||
          firebaseError.message.includes('exceeded')) {
        return res.status(503).json({
          success: false,
          message: 'Service temporarily unavailable due to high demand. Please try again in a few minutes.',
          error: 'SERVICE_UNAVAILABLE',
          retryAfter: 300 // 5 minutes
        });
      } else if (firebaseError.code === 'permission-denied') {
        return res.status(500).json({
          success: false,
          message: 'Server configuration error. Please contact administrator.',
          error: 'PERMISSION_ERROR',
          details: 'Firebase permissions issue'
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Failed to process password reset request. Please try again.',
          error: 'PROCESSING_ERROR',
          details: process.env.NODE_ENV === 'development' ? firebaseError.message : undefined
        });
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
      storage: 'firestore',
      tokenId: tokenId
    });
    
    // ========== CHECK SENDGRID CONFIGURATION ==========
    if (!SENDGRID_CONFIGURED) {
      console.warn('⚠️ SendGrid not fully configured');
      
      // Even without SendGrid, return success since token was generated
      return res.status(200).json({
        success: true,
        message: 'Password reset token generated (development mode)',
        mode: 'development',
        storage: 'firestore',
        email: normalizedEmail,
        office: officeName,
        officialName: officialName,
        resetLink: resetLink, // Still include for testing
        token: token, // Include for testing
        tokenId: tokenId,
        expiresAt: expiresAt.toISOString(),
        tokenSaved: tokenSaved,
        warning: 'Email not sent - configure SENDGRID_API_KEY and SENDGRID_FROM_EMAIL',
        instructions: 'Use the token above to manually test password reset in development',
        nextSteps: [
          'Add SENDGRID_API_KEY to Vercel environment variables',
          'Add SENDGRID_FROM_EMAIL to Vercel environment variables',
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
          storage: 'firestore',
          email: normalizedEmail,
          office: officeName,
          officialName: officialName,
          expiresAt: expiresAt.toISOString(),
          messageId: messageId,
          tokenSaved: tokenSaved,
          tokenId: tokenId,
          note: 'Please check your inbox and spam folder for the reset link'
        });
      } else {
        console.warn(`⚠️ Unexpected status code from SendGrid: ${statusCode}`);
        
        // Even if SendGrid fails, token was still generated in Firestore
        return res.status(200).json({
          success: true,
          message: 'Password reset token generated but email sending had issues',
          storage: 'firestore',
          email: normalizedEmail,
          office: officeName,
          officialName: officialName,
          resetLink: resetLink,
          token: token,
          tokenId: tokenId,
          expiresAt: expiresAt.toISOString(),
          tokenSaved: tokenSaved,
          sendGridStatus: statusCode,
          warning: 'Email sending had issues, but token was generated and saved',
          instructions: 'Check your email or use the reset link if needed'
        });
      }
      
    } catch (sendGridError) {
      console.error('❌ SendGrid Error:', sendGridError.message);
      
      // Even if SendGrid completely fails, token is still in Firestore
      return res.status(200).json({
        success: true,
        message: 'Password reset token generated but email sending failed',
        storage: 'firestore',
        email: normalizedEmail,
        office: officeName,
        officialName: officialName,
        resetLink: resetLink,
        token: token,
        tokenId: tokenId,
        expiresAt: expiresAt.toISOString(),
        tokenSaved: tokenSaved,
        sendGridError: sendGridError.message,
        warning: 'Email sending failed, but token was generated and saved',
        instructions: 'Use the reset link above to complete password reset',
        troubleshooting: [
          'Check your spam folder',
          'Verify email address is correct',
          'Contact support if issue persists'
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
      timestamp: new Date().toISOString()
    });
  }
}