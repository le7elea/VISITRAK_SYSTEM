export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  return res.status(200).json({
    success: true,
    message: 'Test API is working!',
    dependencies: {
      hasFirebaseAdmin: false, // You'll need to install this
      hasSendGrid: !!process.env.SENDGRID_API_KEY,
      hasFirebaseConfig: !!process.env.FIREBASE_PROJECT_ID
    },
    timestamp: new Date().toISOString()
  });
}