import sgMail from '@sendgrid/mail';

export default async function handler(req, res) {
  console.log('API called:', req.method);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Allow GET for testing
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'Password reset API is running',
      environment: 'production',
      timestamp: new Date().toISOString()
    });
  }
  
  // Handle POST
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
      
      // Check SendGrid configuration
      const hasSendGrid = !!process.env.SENDGRID_API_KEY;
      const fromEmail = process.env.SENDGRID_FROM_EMAIL;
      
      if (!hasSendGrid) {
        console.log('SendGrid not configured - simulation mode');
        
        return res.status(200).json({
          success: true,
          message: 'Password reset simulation successful',
          email: normalizedEmail,
          mode: 'simulation',
          note: 'SendGrid API key not configured. In production, an email would be sent.'
        });
      }
      
      // Configure SendGrid
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      
      // Create reset link
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://visitrak-system.vercel.app';
      const resetLink = `${appUrl}/reset-password?email=${encodeURIComponent(normalizedEmail)}`;
      
      // Send email
      const msg = {
        to: normalizedEmail,
        from: fromEmail,
        subject: 'Reset Your VisiTrak Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #5B3886; padding: 20px; text-align: center; color: white;">
              <h1 style="margin: 0;">VisiTrak Password Reset</h1>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
              <p>Hello,</p>
              <p>Click the link below to reset your password:</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" 
                   style="background: #5B3886; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Reset Password
                </a>
              </p>
              <p>This link expires in 15 minutes.</p>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
          </div>
        `,
        text: `Reset your VisiTrak password: ${resetLink}\n\nThis link expires in 15 minutes.`
      };
      
      await sgMail.send(msg);
      console.log('Email sent to:', normalizedEmail);
      
      return res.status(200).json({
        success: true,
        message: 'Password reset email sent successfully',
        email: normalizedEmail
      });
      
    } catch (error) {
      console.error('Error:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to send email',
        error: error.message
      });
    }
  }
  
  // Method not allowed
  return res.status(405).json({
    success: false,
    message: 'Method not allowed'
  });
}